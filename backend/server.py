from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import asyncio
import hashlib
import hmac
import secrets
from access import require_community, community_role, scoped_data, ACTIVE_MEMBERSHIP_STATES
from account_cleanup import clean_account
from password_recovery import configured as recovery_configured, send_reset_code
from moderation import moderation_router, blocked_users, visible_post, require_content_terms, validate_content
from datetime import datetime, timedelta
from pathlib import Path
import os
import logging
import uuid
import jwt
import bcrypt
import base64
import time
from collections import defaultdict, deque
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Environment configuration
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
IS_PRODUCTION = ENVIRONMENT == 'production'

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = 'HS256'
if IS_PRODUCTION and len(JWT_SECRET) < 32:
    raise RuntimeError('Production JWT_SECRET must contain at least 32 characters')
security = HTTPBearer()

# Create the main app with security settings
app = FastAPI(
    title="AuraInfra.ai API",
    version="1.0.0",
    docs_url="/docs" if not IS_PRODUCTION else None,  # Disable docs in production
    redoc_url="/redoc" if not IS_PRODUCTION else None,
    openapi_url="/openapi.json" if not IS_PRODUCTION else None,
    # Don't include request/response bodies in error messages
    include_in_schema=not IS_PRODUCTION
)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": [
        {"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]})


@app.exception_handler(StarletteHTTPException)
async def public_http_error(request: Request, exc: StarletteHTTPException):
    detail = "This service is temporarily unavailable. Please try again." if IS_PRODUCTION and exc.status_code >= 500 else exc.detail
    return JSONResponse(status_code=exc.status_code, content={"detail": detail}, headers=exc.headers)


# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging (minimal in production)
logging.basicConfig(
    level=logging.WARNING if IS_PRODUCTION else logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============= MODELS =============

class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    property_ids: Optional[List[str]] = []  # Properties to join during registration

class UserLogin(BaseModel):
    username: str
    password: str

class PasswordRecoveryRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)

class PasswordResetRequest(PasswordRecoveryRequest):
    code: str = Field(pattern=r"^[0-9]{8}$")
    password: str

class AccountDeleteRequest(BaseModel):
    password: Optional[str] = None

class AppleLoginRequest(BaseModel):
    identity_token: str
    nonce: str
    authorization_code: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    username: str

class UserProfile(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None  # base64 encoded image
    warranty_reminder_days: int = 30
    geomancy_preference: str = "vastu"  # "vastu" or "feng_shui"
    country: Optional[str] = None  # "India", "US", "UK", "Canada", "Australia", "UAE"
    currency_preference: Optional[str] = None  # "USD", "INR", "EUR", etc.
    measurement_system: Optional[str] = None  # "imperial" or "metric"
    is_super_admin: bool = False
    is_hoa_admin: bool = False
    managed_properties: Optional[List[str]] = []  # List of property IDs (admin)
    member_properties: Optional[List[str]] = []  # List of property IDs (resident)
    disclaimer_accepted: bool = False
    disclaimer_accepted_at: Optional[datetime] = None
    ai_consent_at: Optional[datetime] = None
    auth_provider: str = "password"
    has_password: bool = True
    created_at: datetime

class UserProfileUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None  # base64 encoded image
    warranty_reminder_days: Optional[int] = None
    geomancy_preference: Optional[str] = None  # "vastu" or "feng_shui"
    country: Optional[str] = None  # "India", "US", "UK", "Canada", "Australia", "UAE"
    currency_preference: Optional[str] = None  # "USD", "INR", "EUR", etc.
    measurement_system: Optional[str] = None  # "imperial" or "metric"

# Google OAuth Session Models
class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GoogleUser(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

class Property(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    logo: Optional[str] = None  # base64 encoded image
    ownership_type: Optional[str] = 'owner'  # 'owner' or 'tenant'
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PropertyCreate(BaseModel):
    name: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    logo: Optional[str] = None  # base64 encoded image
    ownership_type: Optional[str] = 'owner'  # 'owner' or 'tenant'

class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    logo: Optional[str] = None  # base64 encoded image
    ownership_type: Optional[str] = None  # 'owner' or 'tenant'

# Community Property Models (for registration)
class CommunityProperty(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    logo: Optional[str] = None  # base64 encoded image
    builder_name: Optional[str] = None
    builder_contact: Optional[str] = None
    builder_email: Optional[str] = None
    project_details: Optional[str] = None
    documents: Optional[List[str]] = []  # base64 encoded documents/brochures
    is_active: bool = True  # Show on registration page
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str  # Super admin user_id

class CommunityPropertyCreate(BaseModel):
    name: str
    address: str
    logo: Optional[str] = None
    builder_name: Optional[str] = None
    builder_contact: Optional[str] = None
    builder_email: Optional[str] = None
    project_details: Optional[str] = None
    documents: Optional[List[str]] = []
    is_active: bool = True

class CommunityPropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    logo: Optional[str] = None
    builder_name: Optional[str] = None
    builder_contact: Optional[str] = None
    builder_email: Optional[str] = None
    project_details: Optional[str] = None
    documents: Optional[List[str]] = None
    is_active: Optional[bool] = None

# Maintenance Dues Models
class MaintenanceDue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    user_id: str  # Resident who needs to pay
    amount: float
    due_date: datetime
    description: str
    status: str = "unpaid"  # unpaid, paid, overdue
    user_id: Optional[str] = None
    created_by: str  # Admin user_id
    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None

class MaintenanceDueCreate(BaseModel):
    user_id: str  # For individual
    amount: float
    due_date: datetime
    description: str

class BulkMaintenanceDueCreate(BaseModel):
    amount: float
    due_date: datetime
    description: str
    # Will be sent to all residents of the property

class MaintenanceDueUpdate(BaseModel):
    status: Optional[str] = None
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None

# Property Membership Models
class PropertyMembership(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    property_id: str
    status: Literal["active", "approved", "pending", "rejected", "inactive"] = "pending"
    role: Literal["resident", "owner", "tenant", "security"] = "resident"
    unit_number: Optional[str] = None
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    documents: Optional[List[str]] = []  # base64 encoded documents for verification

class PropertyMembershipCreate(BaseModel):
    user_id: str
    role: str = "resident"
    unit_number: Optional[str] = None
    status: Literal["active", "approved", "pending", "rejected", "inactive"] = "active"

class PropertyMembershipUpdate(BaseModel):
    status: Optional[str] = None
    role: Optional[str] = None
    unit_number: Optional[str] = None

class PropertyDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    name: str
    file_data: str  # base64 encoded file
    file_type: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class PropertyDocumentCreate(BaseModel):
    name: str
    file_data: str  # base64 encoded
    file_type: str

class Fixture(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    name: str
    category: str  # lights, fans, electrical appliances
    make: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    warranty_info: Optional[str] = None
    warranty_expiry_date: Optional[str] = None  # ISO date string
    photo: Optional[str] = None  # base64 encoded photo
    invoice: Optional[str] = None  # base64 encoded invoice
    vendor_name: Optional[str] = None
    vendor_contact: Optional[str] = None
    vendor_email: Optional[str] = None
    maintenance_frequency: Optional[str] = None  # e.g., "Quarterly", "Annually"
    last_maintenance_date: Optional[str] = None  # ISO date string
    created_at: datetime = Field(default_factory=datetime.utcnow)

class FixtureCreate(BaseModel):
    name: str
    category: str
    make: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    warranty_info: Optional[str] = None
    warranty_expiry_date: Optional[str] = None
    photo: Optional[str] = None
    invoice: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_contact: Optional[str] = None
    vendor_email: Optional[str] = None
    maintenance_frequency: Optional[str] = None
    last_maintenance_date: Optional[str] = None

class Measurement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    room_type: str  # master_bedroom, living_area, kitchen, bathroom, dining_area
    floor_number: Optional[int] = 1  # Which floor this room is on, defaults to 1
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    unit: str = "feet"  # feet, meters
    floor_plan_image: Optional[str] = None  # base64 encoded
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MeasurementCreate(BaseModel):
    room_type: str
    floor_number: Optional[int] = 1  # Which floor this room is on, defaults to 1
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    unit: str = "feet"
    floor_plan_image: Optional[str] = None
    notes: Optional[str] = None

class FloorPlanImage(BaseModel):
    floor_number: int
    image: str  # base64 encoded

class FloorPlanAnalysis(BaseModel):
    floor_plans: List[FloorPlanImage]  # Multiple floor plans with floor numbers

class RoomAnalysis(BaseModel):
    room_name: str  # e.g., "Master Bedroom", "Living Room", "Kitchen"
    room_type: str  # master_bedroom, bedroom, living_area, kitchen, bathroom, dining_area, balcony, etc.
    floor_number: int  # Which floor this room is on
    length: Optional[float] = None
    width: Optional[float] = None
    area: Optional[float] = None
    ceiling_height: Optional[float] = None
    windows: Optional[int] = None
    notes: Optional[str] = None

class ComprehensiveFloorPlanAnalysis(BaseModel):
    house_type: str  # e.g., "3 BHK Apartment", "Villa", "Duplex", "Studio", "Bungalow"
    total_bedrooms: int
    total_bathrooms: int
    total_rooms: int
    total_floors: int  # Total number of floors analyzed
    rooms: List[RoomAnalysis]
    overall_notes: Optional[str] = None

class VastuAnalysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    floor_plan_image: str  # base64 encoded
    analysis_text: str
    compliance_score: Optional[int] = None  # 0-100
    recommendations: Optional[str] = None
    geomancy_type: str = "vastu"  # "vastu" or "feng_shui" - stores which type of analysis was performed
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VastuAnalysisCreate(BaseModel):
    floor_plan_image: str  # base64 encoded
    geomancy_type: str = "vastu"  # "vastu" or "feng_shui"

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    property_id: str
    fixture_id: str
    fixture_name: str
    title: str
    message: str
    type: str  # warranty_expiry, etc.
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Appliance Scanner Models
class ApplianceScanRequest(BaseModel):
    image: str  # base64 encoded

class ApplianceScanResult(BaseModel):
    name: str
    category: str
    make: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    confidence: float  # 0-1 confidence score

# Jewelry Scanner Models
class JewelryScanRequest(BaseModel):
    image: str  # base64 encoded image

# Receipt Scanner Models
class ReceiptScanRequest(BaseModel):
    image: str  # base64 encoded receipt image

class ImageScanRequest(BaseModel):
    image: str  # base64 encoded image

class ReceiptScanResult(BaseModel):
    vendor_name: Optional[str] = None
    purchase_date: Optional[str] = None  # ISO format date
    item_name: Optional[str] = None
    item_description: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_cost: Optional[float] = None
    warranty_info: Optional[str] = None
    warranty_months: Optional[int] = None
    confidence: float

# Paint Estimation Models
class WallScanRequest(BaseModel):
    image: str  # base64 encoded
    room_name: Optional[str] = None

class WallDimensions(BaseModel):
    wall_width: float  # in feet
    wall_height: float  # in feet
    doors: int = 0
    windows: int = 0

class PaintEstimate(BaseModel):
    total_wall_area: float  # in sq ft
    paintable_area: float  # in sq ft (excluding doors/windows)
    paint_gallons_needed: float  # for 2 coats
    estimated_cost_low: float  # mock vendor quote
    estimated_cost_high: float  # mock vendor quote
    walls: List[WallDimensions]

class PaintEstimation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    room_name: str
    scan_image: str  # base64 encoded
    total_wall_area: float
    paintable_area: float
    paint_gallons_needed: float
    estimated_cost_low: float
    estimated_cost_high: float
    walls_data: str  # JSON string of wall dimensions
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ============= ASSET MANAGEMENT MODELS =============

# Vehicle Models
class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str  # e.g., "My BMW 3 Series"
    make: Optional[str] = None  # BMW, Toyota, etc.
    model: Optional[str] = None  # 3 Series, Camry, etc.
    year: Optional[int] = None
    vin: Optional[str] = None
    registration_number: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy: Optional[str] = None
    insurance_expiry: Optional[str] = None
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    photos: List[str] = []  # base64 encoded images
    notes: Optional[str] = None
    last_maintenance_date: Optional[str] = None
    next_maintenance_date: Optional[str] = None
    maintenance_frequency_months: Optional[int] = None  # e.g., 6 months
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VehicleCreate(BaseModel):
    name: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    vin: Optional[str] = None
    registration_number: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy: Optional[str] = None
    insurance_expiry: Optional[str] = None
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    photos: List[str] = []
    notes: Optional[str] = None
    last_maintenance_date: Optional[str] = None
    next_maintenance_date: Optional[str] = None
    maintenance_frequency_months: Optional[int] = None

# Jewelry Models
class Jewelry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str  # e.g., "Wedding Ring"
    type: Optional[str] = None  # Ring, Necklace, Bracelet, Earrings
    metal: Optional[str] = None  # Gold, Silver, Platinum
    stones: Optional[str] = None  # Diamond, Ruby, Emerald
    number_of_stones: Optional[int] = None
    weight: Optional[float] = None  # in grams
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    appraisal_value: Optional[float] = None
    appraisal_date: Optional[str] = None
    certificate_number: Optional[str] = None
    certificate_photo: Optional[str] = None  # base64 encoded
    photos: List[str] = []  # base64 encoded images
    notes: Optional[str] = None
    warranty_info: Optional[str] = None
    warranty_expiry_date: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class JewelryCreate(BaseModel):
    name: str
    type: Optional[str] = None
    metal: Optional[str] = None
    stones: Optional[str] = None
    number_of_stones: Optional[int] = None
    weight: Optional[float] = None
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    appraisal_value: Optional[float] = None
    appraisal_date: Optional[str] = None
    certificate_number: Optional[str] = None
    certificate_photo: Optional[str] = None
    photos: List[str] = []
    notes: Optional[str] = None
    warranty_info: Optional[str] = None
    warranty_expiry_date: Optional[str] = None

# Generic Appliance/Electronics Models
class Appliance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    category: str  # TV, Laptop, Refrigerator, Washing Machine, etc.
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    warranty_info: Optional[str] = None
    warranty_expiry_date: Optional[str] = None
    photos: List[str] = []  # base64 encoded images
    invoice: Optional[str] = None  # base64 encoded
    notes: Optional[str] = None
    last_maintenance_date: Optional[str] = None
    next_maintenance_date: Optional[str] = None
    maintenance_frequency_months: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ApplianceCreate(BaseModel):
    name: str
    category: str
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    warranty_info: Optional[str] = None
    warranty_expiry_date: Optional[str] = None
    photos: List[str] = []
    invoice: Optional[str] = None
    notes: Optional[str] = None
    last_maintenance_date: Optional[str] = None
    next_maintenance_date: Optional[str] = None
    maintenance_frequency_months: Optional[int] = None

# Furniture Models
class Furniture(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    category: str  # Sofa, Table, Chair, Bed, Cabinet, etc.
    brand: Optional[str] = None
    material: Optional[str] = None  # Wood, Metal, Fabric, Leather, etc.
    dimensions: Optional[str] = None  # e.g., "L: 200cm x W: 100cm x H: 80cm"
    room_location: Optional[str] = None  # Living Room, Bedroom, etc.
    condition: Optional[str] = None  # Excellent, Good, Fair, Poor
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    warranty_info: Optional[str] = None
    warranty_expiry_date: Optional[str] = None
    photos: List[str] = []  # base64 encoded images
    invoice: Optional[str] = None  # base64 encoded
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class FurnitureCreate(BaseModel):
    name: str
    category: str
    brand: Optional[str] = None
    material: Optional[str] = None
    dimensions: Optional[str] = None
    room_location: Optional[str] = None
    condition: Optional[str] = None
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    warranty_info: Optional[str] = None
    warranty_expiry_date: Optional[str] = None
    photos: List[str] = []
    invoice: Optional[str] = None
    notes: Optional[str] = None

# Art Models
class Art(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    type: str  # Painting, Sculpture, Print, Photograph, etc.
    artist: Optional[str] = None
    medium: Optional[str] = None  # Oil, Watercolor, Bronze, etc.
    dimensions: Optional[str] = None  # e.g., "H: 100cm x W: 80cm"
    year_created: Optional[int] = None
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    appraisal_value: Optional[float] = None
    appraisal_date: Optional[str] = None
    authenticity_certificate: Optional[str] = None  # base64 encoded
    provenance: Optional[str] = None  # History of ownership
    photos: List[str] = []  # base64 encoded images
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ArtCreate(BaseModel):
    name: str
    type: str
    artist: Optional[str] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    year_created: Optional[int] = None
    purchase_date: Optional[str] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    appraisal_value: Optional[float] = None
    appraisal_date: Optional[str] = None
    authenticity_certificate: Optional[str] = None
    provenance: Optional[str] = None
    photos: List[str] = []
    notes: Optional[str] = None

# AI Scan Results
class VehicleScanRequest(BaseModel):
    image: str  # base64 encoded

class VehicleScanResult(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None
    body_type: Optional[str] = None
    vin: Optional[str] = None
    license_plate: Optional[str] = None
    estimated_value: Optional[float] = None
    confidence: float

class JewelryScanResult(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = "Unknown"
    metal: Optional[str] = None
    stones: Optional[str] = None
    weight: Optional[float] = None
    estimated_value: Optional[float] = None
    confidence: float

class FurnitureScanResult(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = "Unknown"
    brand: Optional[str] = None
    material: Optional[str] = None
    style: Optional[str] = None
    estimated_age: Optional[str] = None
    condition: Optional[str] = None
    confidence: float

class ArtScanResult(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = "Unknown"
    artist: Optional[str] = None
    medium: Optional[str] = None
    style: Optional[str] = None
    estimated_period: Optional[str] = None
    subject_matter: Optional[str] = None
    confidence: float


# Maintenance Tracking Models
class MaintenanceRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    asset_type: str  # "property", "vehicle", "appliance", etc.
    asset_id: str
    asset_name: str  # For display purposes
    maintenance_type: str  # "service", "inspection", "repair", "cleaning", etc.
    description: str
    due_date: datetime
    completed: bool = False
    completed_date: Optional[datetime] = None
    cost: Optional[float] = None
    notes: Optional[str] = None
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    recurring: bool = False
    recurring_interval_days: Optional[int] = None  # e.g., 90 for quarterly

class MaintenanceCreate(BaseModel):
    asset_type: str
    asset_id: str
    asset_name: str
    maintenance_type: str
    description: str
    due_date: datetime
    cost: Optional[float] = None
    notes: Optional[str] = None
    recurring: bool = False
    recurring_interval_days: Optional[int] = None

class MaintenanceUpdate(BaseModel):
    maintenance_type: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    completed: Optional[bool] = None
    completed_date: Optional[datetime] = None
    cost: Optional[float] = None
    notes: Optional[str] = None
    recurring: Optional[bool] = None
    recurring_interval_days: Optional[int] = None


# ============= PROPERTY MANAGEMENT MODELS =============

# HOA Maintenance Charges
class HOACharge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    title: str
    description: str
    amount: float
    currency: str = "USD"
    due_date: datetime
    status: str = "pending"  # "pending", "paid", "overdue", "cancelled"
    user_id: Optional[str] = None
    created_by: str  # Admin user_id
    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_date: Optional[datetime] = None
    stripe_session_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None

class HOAChargeCreate(BaseModel):
    property_id: str
    title: str
    description: str
    amount: float
    currency: str = "USD"
    due_date: datetime

class HOAChargeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None

# Payment Transactions
class HOACheckoutRequest(BaseModel):
    charge_id: str
    origin_url: Optional[str] = None

class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    charge_id: str  # HOACharge id
    property_id: str
    amount: float
    currency: str
    stripe_session_id: str
    stripe_payment_intent_id: Optional[str] = None
    payment_status: str = "pending"  # "pending", "paid", "failed", "cancelled"
    metadata: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Visitor Management
class Visitor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    host_user_id: str  # Resident who invited
    visitor_name: str
    visitor_phone: str
    visitor_photo: Optional[str] = None  # base64
    purpose: str
    expected_date: datetime
    expected_time: Optional[str] = None
    status: str = "pending"  # "pending", "approved", "checked_in", "checked_out", "rejected", "expired"
    approval_code: Optional[str] = None  # QR code data
    approved_by: Optional[str] = None  # Security/Admin user_id
    approved_at: Optional[datetime] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VisitorCreate(BaseModel):
    property_id: str
    visitor_name: str
    visitor_phone: str
    visitor_photo: Optional[str] = None
    purpose: str
    expected_date: datetime
    expected_time: Optional[str] = None
    notes: Optional[str] = None

class VisitorUpdate(BaseModel):
    visitor_name: Optional[str] = None
    visitor_phone: Optional[str] = None
    visitor_photo: Optional[str] = None
    purpose: Optional[str] = None
    expected_date: Optional[datetime] = None
    expected_time: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class VisitorApproval(BaseModel):
    status: Literal["approved", "rejected"]
    notes: Optional[str] = None

class VisitorCheckIn(BaseModel):
    check_in_time: datetime = Field(default_factory=datetime.utcnow)

class VisitorCheckOut(BaseModel):
    check_out_time: datetime = Field(default_factory=datetime.utcnow)

# Community Board
class CommunityPost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    user_id: str
    user_name: str  # For display
    user_role: Optional[str] = None  # "owner", "tenant", "resident"
    title: str
    content: str
    category: str  # "announcement", "discussion", "event", "complaint", "general"
    is_pinned: bool = False
    is_admin_post: bool = False
    photos: Optional[List[str]] = None  # base64 images
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    likes_count: int = 0
    comments_count: int = 0
    moderation_status: str = "pending"

class CommunityPostCreate(BaseModel):
    property_id: str
    title: str
    content: str
    category: str = "general"
    photos: Optional[List[str]] = None

class CommunityPostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    is_pinned: Optional[bool] = None
    photos: Optional[List[str]] = None

class CommunityComment(BaseModel):
    moderation_status: str = "pending"
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    user_id: str
    user_name: str  # For display
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CommunityCommentCreate(BaseModel):
    post_id: str
    content: str

class CommunityCommentUpdate(BaseModel):
    content: str

class PostLike(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ============= HOA FEATURES MODELS =============

# Amenities Booking
class Amenity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    name: str  # "Clubhouse", "Gym", "Pool", "Party Hall"
    description: str
    capacity: Optional[int] = None
    booking_fee: Optional[float] = None
    available_hours_start: str = "09:00"  # HH:MM format
    available_hours_end: str = "22:00"
    advance_booking_days: int = 30
    max_booking_hours: int = 4
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AmenityCreate(BaseModel):
    property_id: str
    name: str
    description: str
    capacity: Optional[int] = None
    booking_fee: Optional[float] = None
    available_hours_start: str = "09:00"
    available_hours_end: str = "22:00"

class AmenityBooking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    amenity_id: str
    property_id: str
    user_id: str
    user_name: str
    booking_date: datetime
    start_time: str  # HH:MM format
    end_time: str
    purpose: Optional[str] = None
    status: str = "pending"  # "pending", "approved", "rejected", "cancelled"
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    payment_status: str = "unpaid"  # "unpaid", "paid"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AmenityBookingCreate(BaseModel):
    amenity_id: str
    booking_date: datetime
    start_time: str
    end_time: str
    purpose: Optional[str] = None

class AmenityBookingUpdate(BaseModel):
    status: Optional[Literal["approved", "rejected", "cancelled"]] = None
    payment_status: Optional[str] = None

# Complaints/Service Requests
class Complaint(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    user_id: str
    user_name: str
    category: str  # "maintenance", "plumbing", "electrical", "cleaning", "security", "other"
    priority: str = "medium"  # "low", "medium", "high", "urgent"
    subject: str
    description: str
    location: Optional[str] = None
    photos: Optional[List[str]] = None  # base64 images
    status: str = "pending"  # "pending", "in_progress", "resolved", "closed"
    assigned_to: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ComplaintCreate(BaseModel):
    property_id: str
    category: str
    priority: str = "medium"
    subject: str
    description: str
    location: Optional[str] = None
    photos: Optional[List[str]] = None

class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None

# Document Repository
class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    title: str
    category: str  # "bylaws", "minutes", "financial", "notice", "form", "other"
    description: Optional[str] = None
    file_url: Optional[str] = None  # URL or base64 (deprecated, use file_data)
    file_data: Optional[str] = None  # base64 encoded file content
    file_type: Optional[str] = None  # MIME type
    file_name: Optional[str] = None
    file_size: Optional[int] = None  # in bytes
    uploaded_by: str  # user_id
    upload_date: datetime = Field(default_factory=datetime.utcnow)
    is_public: bool = True  # All residents can view

class DocumentCreate(BaseModel):
    property_id: str
    title: str
    category: str
    description: Optional[str] = None
    file_url: Optional[str] = None
    file_data: Optional[str] = None  # base64 encoded file content
    file_type: Optional[str] = None  # MIME type
    file_name: Optional[str] = None
    file_size: Optional[int] = None

# Meeting Scheduler
class Meeting(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    title: str
    description: str
    meeting_type: str = "general"  # "general", "committee", "emergency", "agm"
    date: datetime
    time: str  # HH:MM format
    duration_minutes: int = 60
    location: str
    agenda: Optional[List[str]] = None
    organizer_id: str
    organizer_name: str
    max_attendees: Optional[int] = None
    rsvp_deadline: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MeetingCreate(BaseModel):
    property_id: str
    title: str
    description: str
    meeting_type: str = "general"
    date: datetime
    time: str
    duration_minutes: int = 60
    location: str
    agenda: Optional[List[str]] = None
    max_attendees: Optional[int] = None
    rsvp_deadline: Optional[datetime] = None

class MeetingRSVP(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    meeting_id: str
    user_id: str
    user_name: str
    status: str  # "attending", "not_attending", "maybe"
    guests_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class RSVPCreate(BaseModel):
    meeting_id: str
    status: str
    guests_count: int = 0


# ============= ADMIN & USER APPROVAL MODELS =============
class PendingUserApproval(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    username: str
    email: str
    property_id: str
    property_name: str
    requested_role: str  # "owner", "tenant", "resident"
    documents: List[str] = []  # List of base64 encoded documents
    document_names: List[str] = []  # Names of documents
    status: str = "pending"  # "pending", "approved", "rejected"
    admin_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None  # Admin user ID

class ApprovalRequest(BaseModel):
    property_id: str
    requested_role: Literal["owner", "tenant", "resident"]
    documents: List[str]  # base64 documents
    document_names: List[str]

class ApprovalAction(BaseModel):
    approval_id: str
    action: Literal["approve", "reject"]
    admin_notes: Optional[str] = None

class PropertyAdminAssignment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    admin_user_id: str
    property_id: str
    assigned_by: str  # Super admin user ID
    assigned_at: datetime = Field(default_factory=datetime.utcnow)

class AdminDashboardStats(BaseModel):
    property_id: str
    total_users: int
    pending_approvals: int
    active_residents: int
    payment_requests_sent: int
    payments_received: int
    unpaid_amount: float
    recent_posts: int
    upcoming_meetings: int


# Portfolio Summary
class PortfolioSummary(BaseModel):
    total_value: float
    properties_value: float
    vehicles_value: float
    appliances_value: float
    jewelry_value: float
    furniture_value: float
    art_value: float
    properties_count: int
    vehicles_count: int
    appliances_count: int
    jewelry_count: int
    furniture_count: int
    art_count: int

class UserSettings(BaseModel):
    warranty_reminder_days: int = 30  # 7, 14, or 30 days

# ============= HELPER FUNCTIONS =============

def create_access_token(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + timedelta(days=7), "iat": datetime.utcnow(), "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def issue_auth_token(user_doc, provider="password"):
    if user_doc.get("disabled") or user_doc.get("deletion_pending"):
        raise HTTPException(status_code=401, detail="Account is unavailable")
    token = create_access_token({"user_id": user_doc["id"], "username": user_doc["username"]})
    claims = verify_token(token)
    await db.user_sessions.insert_one({
        "jti": claims["jti"], "user_id": user_doc["id"], "provider": provider,
        "authenticated_at": datetime.utcnow(),
        "credential_version": user_doc.get("credential_version", 0),
        "expires_at": datetime.utcfromtimestamp(claims["exp"]),
    })
    return Token(access_token=token, token_type="bearer", user_id=user_doc["id"], username=user_doc["username"])

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    claims = verify_token(credentials.credentials)
    user_id, jti = claims.get("user_id"), claims.get("jti")
    if not user_id or not jti:
        raise HTTPException(status_code=401, detail="Please sign in again")
    session = await db.user_sessions.find_one({"jti": jti, "user_id": user_id, "expires_at": {"$gt": datetime.utcnow()}})
    user = await db.users.find_one({"id": user_id})
    if (not session or not user or user.get("disabled") or user.get("deletion_pending")
            or session.get("credential_version", 0) != user.get("credential_version", 0)):
        raise HTTPException(status_code=401, detail="Session is no longer valid")
    return user_id

class LoginRateLimiter:
    """
    Simple in-memory sliding-window rate limiter to slow down brute-force /
    credential-stuffing attempts against login and registration.

    Note: this state lives in process memory, so it resets on restart and
    is per-instance only (won't share limits across multiple backend
    replicas). Acceptable for a single instance; use Redis if scaling out.
    """
    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts = defaultdict(deque)

    def check(self, key: str):
        now = time.time()
        attempts = self._attempts[key]
        while attempts and now - attempts[0] > self.window_seconds:
            attempts.popleft()
        if len(attempts) >= self.max_attempts:
            retry_after = int(self.window_seconds - (now - attempts[0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many attempts. Try again in {max(retry_after, 1)} seconds.",
            )
        attempts.append(now)

login_rate_limiter = LoginRateLimiter(max_attempts=30, window_seconds=300)
register_rate_limiter = LoginRateLimiter(max_attempts=10, window_seconds=3600)
recovery_rate_limiter = LoginRateLimiter(max_attempts=3, window_seconds=3600)

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and os.environ.get("TRUST_PROXY_HEADERS") == "true":
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

async def get_current_admin_user(user_id: str = Depends(get_current_user)):
    """
    Requires the user's is_admin flag (or platform super-admin) to be set in
    the database before allowing access. Checking the DB (rather than trusting
    a claim in the JWT) means revoking admin access takes effect immediately.
    """
    user_doc = await db.users.find_one({"id": user_id}, {"is_admin": 1, "is_super_admin": 1})
    if not user_doc or not (user_doc.get("is_admin", False) or user_doc.get("is_super_admin", False)):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id

# ============= AUTH ENDPOINTS =============

@api_router.post("/auth/register", response_model=Token)
async def register(user: UserRegister, request: Request):
    if not user.username.strip() or len(user.password.encode("utf-8")) < 8 or len(user.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Use a username and a password of 8–72 UTF-8 bytes")
    user.email = user.email.strip().lower()
    if "@" not in user.email:
        raise HTTPException(status_code=400, detail="A valid email is required")
    for property_id in set(user.property_ids or []):
        await find_joinable_property(property_id)
    register_rate_limiter.check(get_client_ip(request))
    # Check if username exists
    existing_user = await db.users.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email exists
    existing_email = await db.users.find_one({"email": user.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Hash password
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": user.username,
        "email": user.email,
        "password": hashed_password.decode('utf-8'),
        "phone": None,
        "warranty_reminder_days": 30,
        "geomancy_preference": "vastu",
        "is_super_admin": False,
        "is_hoa_admin": False,
        "is_admin": False,
        "managed_properties": [],
        "member_properties": [],
        "disclaimer_accepted": False,
        "disclaimer_accepted_at": None,
        "created_at": datetime.utcnow()
    }
    
    try:
        await db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Username or email already exists")
    
    for property_id in set(user.property_ids or []):
        await submit_membership_request(property_id, user_id, "resident", [], [])
    return await issue_auth_token(user_doc)

@api_router.post("/auth/login", response_model=Token)
async def login(user: UserLogin, request: Request):
    login_rate_limiter.check(get_client_ip(request))
    login_rate_limiter.check(f"username:{user.username.lower()}")
    # Find user by username or email
    # Check if the input contains '@' to determine if it's an email
    if '@' in user.username:
        # Search by email
        user_doc = await db.users.find_one({"email": user.username.strip().lower()})
    else:
        # Search by username
        user_doc = await db.users.find_one({"username": user.username})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user has a password (some users might not have passwords if created through admin/social login)
    if "password" not in user_doc or not user_doc["password"]:
        raise HTTPException(
            status_code=401, 
            detail="This account was created without a password. Please contact the administrator or use social login."
        )
    
    # Verify password
    if len(user.password.encode()) > 72 or not bcrypt.checkpw(user.password.encode('utf-8'), user_doc["password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return await issue_auth_token(user_doc)

def reset_code_hash(email, code):
    return hmac.new(JWT_SECRET.encode(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


@api_router.post("/auth/forgot-password")
async def forgot_password(payload: PasswordRecoveryRequest, request: Request):
    email = payload.email.strip().lower()
    login_rate_limiter.check(f"recovery-ip:{get_client_ip(request)}")
    recovery_rate_limiter.check(f"email:{email}")
    if not recovery_configured():
        raise HTTPException(status_code=503, detail="Password recovery is temporarily unavailable. Contact support@aurainfra.ai.")
    user = await db.users.find_one({"email": email, "disabled": {"$ne": True}, "deletion_pending": {"$ne": True}})
    if user and user.get("password"):
        code = f"{secrets.randbelow(100_000_000):08d}"
        reset_id = str(uuid.uuid4())
        await db.password_resets.update_one({"email": email}, {"$set": {
            "id": reset_id, "user_id": user["id"], "code_hash": reset_code_hash(email, code),
            "attempts": 0, "expires_at": datetime.utcnow() + timedelta(minutes=10),
            "credential_version": user.get("credential_version", 0),
        }}, upsert=True)
        try:
            await send_reset_code(email, code)
        except Exception:
            # Preserve the same public response for all identities and mail failures.
            await db.password_resets.delete_one({"id": reset_id})
            logger.warning("Password recovery email delivery failed")
    return {"message": "If this email belongs to an available password account, a reset code has been sent. For Google or Apple accounts, use the original sign-in provider."}


@api_router.post("/auth/reset-password")
async def reset_password(payload: PasswordResetRequest, request: Request):
    login_rate_limiter.check(f"reset-ip:{get_client_ip(request)}")
    if not 8 <= len(payload.password.encode()) <= 72:
        raise HTTPException(status_code=400, detail="Use a password of 8–72 UTF-8 bytes")
    email = payload.email.strip().lower()
    # Increment atomically, including incorrect guesses; at most five attempts per code.
    from pymongo import ReturnDocument
    reset = await db.password_resets.find_one_and_update({"email": email,
        "expires_at": {"$gt": datetime.utcnow()}, "attempts": {"$lt": 5}},
        {"$inc": {"attempts": 1}}, return_document=ReturnDocument.AFTER)
    if not reset or not secrets.compare_digest(reset["code_hash"], reset_code_hash(email, payload.code)):
        raise HTTPException(status_code=400, detail="Invalid or expired reset code. Request a new code.")
    hashed = await asyncio.to_thread(bcrypt.hashpw, payload.password.encode(), bcrypt.gensalt())
    version = reset.get("credential_version", 0)
    # One atomic account update makes the code single-use and revokes every old session,
    # including a login racing with this request or a partially failed cleanup.
    result = await db.users.update_one({"id": reset["user_id"], "email": email,
        "password": {"$type": "string"}, "disabled": {"$ne": True}, "deletion_pending": {"$ne": True},
        "credential_version": {"$in": [None, 0]} if version == 0 else version},
        {"$set": {"password": hashed.decode()}, "$inc": {"credential_version": 1}})
    if not result.modified_count:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code. Request a new code.")
    await db.password_resets.delete_one({"id": reset["id"]})
    return {"message": "Password changed. Sign in again on each device."}


@api_router.delete("/auth/account")
async def delete_account(payload: AccountDeleteRequest, credentials: HTTPAuthorizationCredentials = Depends(security), user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if user.get("password"):
        if not payload.password or len(payload.password.encode()) > 72 or not bcrypt.checkpw(payload.password.encode(), user["password"].encode()):
            raise HTTPException(status_code=401, detail="Incorrect password")
    else:
        claims = verify_token(credentials.credentials)
        session = await db.user_sessions.find_one({"jti": claims["jti"], "user_id": user_id,
            "provider": user.get("auth_provider"), "authenticated_at": {"$gt": datetime.utcnow() - timedelta(minutes=5)}})
        if not session:
            raise HTTPException(status_code=401, detail="Sign in again with your original provider before deleting your account")
    properties = await db.properties.find({"user_id": user_id}, {"id": 1}).to_list(length=None)
    property_ids = [p["id"] for p in properties]
    posts = await db.community_posts.find({"$or": [{"user_id": user_id}, {"property_id": {"$in": property_ids}}]}, {"id": 1}).to_list(length=None)
    meetings = await db.meetings.find({"property_id": {"$in": property_ids}}, {"id": 1}).to_list(length=None)
    job = {"id": str(uuid.uuid4()), "user_id": user_id, "property_ids": property_ids,
        "post_ids": [p["id"] for p in posts], "meeting_ids": [m["id"] for m in meetings],
        "status": "pending", "created_at": datetime.utcnow(), "apple_token": user.get("apple_refresh_token")}
    await db.account_deletions.insert_one(job)
    # Durable job is saved first. Every authenticated request now fails immediately.
    await db.users.update_one({"id": user_id}, {"$set": {"deletion_pending": True}})
    await db.user_sessions.delete_many({"user_id": user_id})
    try:
        await process_deletion(job)
    except Exception:
        logger.exception("Account cleanup queued for retry")
        return JSONResponse(status_code=202, content={"status": "pending", "request_id": job["id"],
            "message": "Account disabled. Deletion is queued and will retry automatically."})
    return {"status": "completed", "request_id": job["id"], "message": "Account deleted. Community accounting records are anonymized."}

async def process_deletion(job):
    if job.get("apple_token"):
        await revoke_apple_token(job["apple_token"])
    await clean_account(db, job)

async def deletion_worker():
    while True:
        try:
            jobs = await db.account_deletions.find({"status": "pending"}).to_list(length=100)
            for job in jobs:
                await db.users.update_one({"id": job["user_id"]}, {"$set": {"deletion_pending": True}})
                await db.user_sessions.delete_many({"user_id": job["user_id"]})
                try:
                    await process_deletion(job)
                except Exception:
                    logger.exception("Account deletion retry failed")
        except Exception:
            logger.exception("Account deletion worker failed")
        await asyncio.sleep(30)

@api_router.get("/auth/profile", response_model=UserProfile)
async def get_profile(user_id: str = Depends(get_current_user)):
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get managed properties if user is HOA admin
    managed_properties = []
    admin_assignments = await db.property_admin_assignments.find({"admin_user_id": user_id}).to_list(length=1000)
    managed_properties = [assignment["property_id"] for assignment in admin_assignments]
    if user_doc.get("is_super_admin"):
        communities = await db.community_properties.find({"is_active": True}, {"id": 1}).to_list(length=1000)
        managed_properties = list(set(managed_properties + [c["id"] for c in communities]))
    
    # Get member properties from user document
    memberships = await db.property_memberships.find({"user_id": user_id, "status": {"$in": ACTIVE_MEMBERSHIP_STATES}}).to_list(length=1000)
    member_properties = [m["property_id"] for m in memberships]
    
    return UserProfile(
        id=user_doc["id"],
        username=user_doc["username"],
        email=user_doc.get("email"),
        phone=user_doc.get("phone"),
        avatar=user_doc.get("avatar"),
        warranty_reminder_days=user_doc.get("warranty_reminder_days", 30),
        geomancy_preference=user_doc.get("geomancy_preference", "vastu"),
        country=user_doc.get("country"),
        currency_preference=user_doc.get("currency_preference"),
        measurement_system=user_doc.get("measurement_system"),
        is_super_admin=user_doc.get("is_super_admin", False),
        is_hoa_admin=bool(admin_assignments),
        managed_properties=managed_properties,
        member_properties=member_properties,
        disclaimer_accepted=user_doc.get("disclaimer_accepted", False),
        disclaimer_accepted_at=user_doc.get("disclaimer_accepted_at"),
        ai_consent_at=user_doc.get("ai_consent_at"),
        auth_provider=user_doc.get("auth_provider", "password"),
        has_password=bool(user_doc.get("password")),
        created_at=user_doc["created_at"]
    )

@api_router.put("/auth/profile", response_model=UserProfile)
async def update_profile(profile: UserProfileUpdate, user_id: str = Depends(get_current_user)):
    # Update user profile
    update_data = {}
    if profile.email is not None:
        user = await db.users.find_one({"id": user_id})
        email = profile.email.strip().lower()
        if user.get("auth_provider") in {"google", "apple"} and email != user.get("email"):
            raise HTTPException(status_code=400, detail="The sign-in email is managed by your authentication provider")
        if "@" not in email:
            raise HTTPException(status_code=400, detail="A valid email is required")
        existing = await db.users.find_one({"email": email, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=409, detail="Email already belongs to another account")
        update_data["email"] = email
    if profile.phone is not None:
        update_data["phone"] = profile.phone
    if profile.avatar is not None:
        update_data["avatar"] = profile.avatar
    if profile.warranty_reminder_days is not None:
        if profile.warranty_reminder_days not in [7, 14, 30]:
            raise HTTPException(status_code=400, detail="warranty_reminder_days must be 7, 14, or 30")
        update_data["warranty_reminder_days"] = profile.warranty_reminder_days
    if profile.geomancy_preference is not None:
        if profile.geomancy_preference not in ["vastu", "feng_shui"]:
            raise HTTPException(status_code=400, detail="geomancy_preference must be 'vastu' or 'feng_shui'")
        update_data["geomancy_preference"] = profile.geomancy_preference
    if profile.currency_preference is not None:
        update_data["currency_preference"] = profile.currency_preference
    if profile.measurement_system is not None:
        if profile.measurement_system not in ["metric", "imperial"]:
            raise HTTPException(status_code=400, detail="measurement_system must be 'metric' or 'imperial'")
        update_data["measurement_system"] = profile.measurement_system
    if profile.country is not None:
        if profile.country != "" and profile.country not in ["India", "US", "UK", "Canada", "Australia", "UAE"]:
            raise HTTPException(status_code=400, detail="country must be one of: India, US, UK, Canada, Australia, UAE")
        update_data["country"] = profile.country
    
    if update_data:
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
    
    return await get_profile(user_id)

# ============= GOOGLE OAUTH SESSION ENDPOINTS =============

import httpx
from fastapi.responses import JSONResponse
from datetime import timezone

@api_router.post("/auth/session")
async def process_session_id(request: Request):
    login_rate_limiter.check(get_client_ip(request))
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID header")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}, timeout=10.0)
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google authentication")
        identity = response.json()
        email = str(identity.get("email", "")).strip().lower()
        if not email or not identity.get("session_token"):
            raise HTTPException(status_code=401, detail="Invalid Google identity")
        # Consume the provider session once; refresh requires a new sign-in.
        digest = hashlib.sha256(session_id.encode()).hexdigest()
        result = await db.oauth_exchanges.update_one(
            {"id": digest}, {"$setOnInsert": {"id": digest, "created_at": datetime.utcnow()}}, upsert=True)
        if not result.upserted_id:
            raise HTTPException(status_code=401, detail="Authentication has already been used")
        subject = identity.get("id") or identity.get("sub")
        user = await db.users.find_one({"google_subject": str(subject), "auth_provider": "google"}) if subject else None
        if not user:
            user = await db.users.find_one({"email": email})
        if user and user.get("auth_provider") != "google":
            raise HTTPException(status_code=409, detail="Use your original sign-in method for this email")
        if not user:
            user = new_social_user("google", email)
            await db.users.insert_one(user)
        if subject:
            if user.get("google_subject") and user["google_subject"] != str(subject):
                raise HTTPException(status_code=409, detail="Use your original sign-in identity")
            await db.users.update_one({"id": user["id"]}, {"$set": {"google_subject": str(subject)}})
        return await issue_auth_token(user, "google")
    except HTTPException:
        raise
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Account already exists; please sign in again")
    except (httpx.RequestError, ValueError, KeyError):
        raise HTTPException(status_code=502, detail="Google authentication is unavailable; try again")
            
            
def new_social_user(provider, email=None, subject=None):
    user_id = str(uuid.uuid4())
    return {
        "id": user_id, "username": f"{provider}_{user_id[:12]}", "email": email,
        "auth_provider": provider, "apple_subject": subject, "password": None,
        "is_admin": False, "is_super_admin": False, "is_hoa_admin": False,
        "managed_properties": [], "member_properties": [], "disclaimer_accepted": False,
        "created_at": datetime.utcnow(),
    }
        
@api_router.post("/auth/apple/challenge")
async def apple_challenge(request: Request):
    login_rate_limiter.check(get_client_ip(request))
    nonce = secrets.token_urlsafe(32)
    await db.apple_challenges.insert_one({"id": hashlib.sha256(nonce.encode()).hexdigest(),
        "expires_at": datetime.utcnow() + timedelta(minutes=5)})
    return {"nonce": nonce}
        
async def verify_apple_identity(identity_token, nonce):
    audience = os.environ.get("APPLE_CLIENT_ID", "com.aurainfra.ai")
    try:
        jwks = jwt.PyJWKClient("https://appleid.apple.com/auth/keys", timeout=10)
        key = await asyncio.to_thread(jwks.get_signing_key_from_jwt, identity_token)
        claims = jwt.decode(identity_token, key.key, algorithms=["RS256"],
            audience=audience, issuer="https://appleid.apple.com",
            options={"require": ["exp", "iat", "sub", "nonce"]})
        # Expo passes the nonce through; it must match the server-issued challenge.
        if not secrets.compare_digest(str(claims["nonce"]), nonce):
            raise HTTPException(status_code=401, detail="Invalid Apple nonce")
        return claims
    except HTTPException:
        raise
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid Apple authentication")
        
@api_router.post("/auth/apple", response_model=Token)
async def apple_login(payload: AppleLoginRequest, request: Request):
    login_rate_limiter.check(get_client_ip(request))
    claims = await verify_apple_identity(payload.identity_token, payload.nonce)
    challenge = await db.apple_challenges.find_one_and_delete({
        "id": hashlib.sha256(payload.nonce.encode()).hexdigest(), "expires_at": {"$gt": datetime.utcnow()}})
    if not challenge:
        raise HTTPException(status_code=401, detail="Apple authentication expired or already used")
    if not payload.authorization_code:
        raise HTTPException(status_code=400, detail="Apple authorization code is required")
    refresh_token = await exchange_apple_code(payload.authorization_code, claims["sub"], payload.nonce)
    user = await db.users.find_one({"apple_subject": claims["sub"], "auth_provider": "apple"})
    if not user:
        email = claims.get("email")
        if email and await db.users.find_one({"email": email.lower()}):
            raise HTTPException(status_code=409, detail="Use your original sign-in method for this email")
        user = new_social_user("apple", email.lower() if email else None, claims["sub"])
        await db.users.insert_one(user)
    await db.users.update_one({"id": user["id"]}, {"$set": {"apple_refresh_token": refresh_token}})
    return await issue_auth_token(user, "apple")


def apple_client_secret():
    required = ["APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY", "APPLE_TOKEN_ENCRYPTION_KEY"]
    if any(not os.environ.get(key) for key in required):
        raise HTTPException(status_code=503, detail="Apple sign-in is not configured")
    now = int(time.time())
    return jwt.encode({"iss": os.environ["APPLE_TEAM_ID"], "iat": now, "exp": now + 300,
        "aud": "https://appleid.apple.com", "sub": os.environ.get("APPLE_CLIENT_ID", "com.aurainfra.ai")},
        os.environ["APPLE_PRIVATE_KEY"].replace("\\n", "\n"), algorithm="ES256", headers={"kid": os.environ["APPLE_KEY_ID"]})

async def exchange_apple_code(code, expected_subject, nonce):
    from cryptography.fernet import Fernet
    secret = apple_client_secret()
    async with httpx.AsyncClient() as client:
        response = await client.post("https://appleid.apple.com/auth/token", data={
            "client_id": os.environ.get("APPLE_CLIENT_ID", "com.aurainfra.ai"), "client_secret": secret,
            "code": code, "grant_type": "authorization_code"}, timeout=10)
    if response.status_code != 200 or not response.json().get("refresh_token"):
        raise HTTPException(status_code=401, detail="Apple authorization failed")
    identity = await verify_apple_identity(response.json().get("id_token", ""), nonce)
    if identity["sub"] != expected_subject:
        raise HTTPException(status_code=401, detail="Apple authorization code does not match the signed-in account")
    return Fernet(os.environ["APPLE_TOKEN_ENCRYPTION_KEY"].encode()).encrypt(response.json()["refresh_token"].encode()).decode()

async def revoke_apple_token(encrypted_token):
    from cryptography.fernet import Fernet
    secret = apple_client_secret()
    token = Fernet(os.environ["APPLE_TOKEN_ENCRYPTION_KEY"].encode()).decrypt(encrypted_token.encode()).decode()
    async with httpx.AsyncClient() as client:
        response = await client.post("https://appleid.apple.com/auth/revoke", data={
            "client_id": os.environ.get("APPLE_CLIENT_ID", "com.aurainfra.ai"), "client_secret": secret,
            "token": token, "token_type_hint": "refresh_token"}, timeout=10)
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Apple revocation is temporarily unavailable")

@api_router.get("/auth/me")
async def get_current_session_user(user_id: str = Depends(get_current_user)):
    return await get_profile(user_id)

@api_router.post("/auth/accept-disclaimer")
async def accept_disclaimer(user_id: str = Depends(get_current_user)):
    """Accept disclaimer and update user record - works with both JWT and session tokens"""
    try:
        # Update user record
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "disclaimer_accepted": True,
                    "disclaimer_accepted_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return {"message": "Disclaimer accepted", "disclaimer_accepted": True}
    except Exception as e:
        logger.error(f"Accept disclaimer error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to accept disclaimer")

@api_router.post("/auth/logout")
async def logout(user_id: str = Depends(get_current_user)):
    # Revoke all sessions for this account; stale copies stop working immediately.
    await db.user_sessions.delete_many({"user_id": user_id})
    response = JSONResponse({"message": "Logged out successfully"})
    response.delete_cookie(key="session_token", path="/")
    return response

# ============= ADMIN ENDPOINTS =============

@api_router.get("/admin/stats")
async def get_admin_stats(user_id: str = Depends(get_current_admin_user)):
    """Get admin statistics - user counts, asset counts, etc."""
    try:
        # Get total user count
        total_users = await db.users.count_documents({})
        
        # Get users registered in last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_users = await db.users.count_documents({
            "created_at": {"$gte": thirty_days_ago}
        })
        
        # Get total assets across all users
        total_properties = await db.properties.count_documents({})
        total_vehicles = await db.vehicles.count_documents({})
        total_appliances = await db.appliances.count_documents({})
        total_jewelry = await db.jewelry.count_documents({})
        total_furniture = await db.furniture.count_documents({})
        total_art = await db.art.count_documents({})
        
        total_assets = (total_properties + total_vehicles + total_appliances + 
                       total_jewelry + total_furniture + total_art)
        
        # Get user list with basic info
        users_cursor = db.users.find({}, {
            "_id": 0,
            "id": 1,
            "username": 1,
            "email": 1,
            "created_at": 1
        }).sort("created_at", -1)
        users_list = await users_cursor.to_list(length=1000)
        
        return {
            "total_users": total_users,
            "recent_users_30d": recent_users,
            "total_assets": total_assets,
            "assets_by_category": {
                "properties": total_properties,
                "vehicles": total_vehicles,
                "appliances": total_appliances,
                "jewelry": total_jewelry,
                "furniture": total_furniture,
                "art": total_art
            },
            "users": users_list
        }
    except Exception as e:
        logger.error(f"Admin stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= PROPERTY ENDPOINTS =============

@api_router.post("/properties", response_model=Property)
async def create_property(property_data: PropertyCreate, user_id: str = Depends(get_current_user)):
    property_obj = Property(
        name=property_data.name,
        address=property_data.address,
        latitude=property_data.latitude,
        longitude=property_data.longitude,
        purchase_cost=property_data.purchase_cost,
        current_value=property_data.current_value,
        logo=property_data.logo,
        ownership_type=property_data.ownership_type,
        user_id=user_id
    )
    await db.properties.insert_one(property_obj.dict())
    return property_obj

@api_router.get("/properties", response_model=List[Property])
async def get_properties(user_id: str = Depends(get_current_user)):
    # Use projection to fetch only needed fields and create index hint
    properties = await db.properties.find(
        {"user_id": user_id},
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "address": 1,
            "latitude": 1,
            "longitude": 1,
            "purchase_cost": 1,
            "current_value": 1,
            "purchase_date": 1,
            "logo": 1,
            "user_id": 1
        }
    ).to_list(1000)
    return [Property(**prop) for prop in properties]

@api_router.get("/properties/{property_id}", response_model=Property)
async def get_property(property_id: str, user_id: str = Depends(get_current_user)):
    await require_community(db, property_id, user_id)
    property_doc = await db.properties.find_one({"id": property_id})
    if property_doc:
        return Property(**property_doc)
    community = await db.community_properties.find_one({"id": property_id})
    if not community:
        raise HTTPException(status_code=404, detail="Property not found")
    return Property(id=community["id"], name=community["name"], address=community["address"],
        user_id="community", latitude=0.0, longitude=0.0,
        created_at=community.get("created_at", datetime.utcnow()))

@api_router.put("/properties/{property_id}", response_model=Property)
async def update_property(
    property_id: str,
    property_data: PropertyUpdate,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Build update data
    update_data = {}
    if property_data.name is not None:
        update_data["name"] = property_data.name
    if property_data.address is not None:
        update_data["address"] = property_data.address
    if property_data.latitude is not None:
        update_data["latitude"] = property_data.latitude
    if property_data.longitude is not None:
        update_data["longitude"] = property_data.longitude
    if property_data.ownership_type is not None:
        update_data["ownership_type"] = property_data.ownership_type
    if property_data.purchase_cost is not None:
        update_data["purchase_cost"] = property_data.purchase_cost
    if property_data.current_value is not None:
        update_data["current_value"] = property_data.current_value
    # Handle logo field explicitly (including when set to None)
    if 'logo' in property_data.__fields_set__:
        update_data["logo"] = property_data.logo
    
    if update_data:
        await db.properties.update_one(
            {"id": property_id},
            {"$set": update_data}
        )
    
    # Return updated property
    updated_property = await db.properties.find_one({"id": property_id})
    return Property(**updated_property)

@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str, user_id: str = Depends(get_current_user)):
    result = await db.properties.delete_one({"id": property_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Also delete related documents, fixtures, and measurements
    await db.documents.delete_many({"property_id": property_id})
    await db.fixtures.delete_many({"property_id": property_id})
    await db.measurements.delete_many({"property_id": property_id})
    
    return {"message": "Property deleted successfully"}

# ============= DOCUMENT ENDPOINTS =============

@api_router.post("/properties/{property_id}/documents", response_model=PropertyDocument)
async def create_document(
    property_id: str,
    document: PropertyDocumentCreate,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    doc_obj = PropertyDocument(
        property_id=property_id,
        name=document.name,
        file_data=document.file_data,
        file_type=document.file_type
    )
    await db.property_documents.insert_one(doc_obj.dict())
    return doc_obj

@api_router.get("/properties/{property_id}/documents", response_model=List[PropertyDocument])
async def get_documents(property_id: str, user_id: str = Depends(get_current_user)):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    documents = await db.property_documents.find({"property_id": property_id}).to_list(1000)
    return [PropertyDocument(**doc) for doc in documents]

@api_router.delete("/properties/{property_id}/documents/{document_id}")
async def delete_document(
    property_id: str,
    document_id: str,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    result = await db.property_documents.delete_one({"id": document_id, "property_id": property_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted successfully"}

# ============= FIXTURE ENDPOINTS =============

@api_router.post("/properties/{property_id}/fixtures", response_model=Fixture)
async def create_fixture(
    property_id: str,
    fixture: FixtureCreate,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    fixture_obj = Fixture(
        property_id=property_id,
        **fixture.dict()
    )
    await db.fixtures.insert_one(fixture_obj.dict())
    return fixture_obj

@api_router.get("/properties/{property_id}/fixtures", response_model=List[Fixture])
async def get_fixtures(property_id: str, user_id: str = Depends(get_current_user)):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    fixtures = await db.fixtures.find({"property_id": property_id}).to_list(1000)
    return [Fixture(**fix) for fix in fixtures]

@api_router.get("/properties/{property_id}/fixtures/{fixture_id}", response_model=Fixture)
async def get_fixture(
    property_id: str,
    fixture_id: str,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    fixture_doc = await db.fixtures.find_one({"id": fixture_id, "property_id": property_id})
    if not fixture_doc:
        raise HTTPException(status_code=404, detail="Fixture not found")
    
    return Fixture(**fixture_doc)

@api_router.put("/properties/{property_id}/fixtures/{fixture_id}", response_model=Fixture)
async def update_fixture(
    property_id: str,
    fixture_id: str,
    fixture: FixtureCreate,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Update fixture
    update_data = fixture.dict(exclude_unset=True)
    result = await db.fixtures.update_one(
        {"id": fixture_id, "property_id": property_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fixture not found")
    
    # Return updated fixture
    updated_fixture = await db.fixtures.find_one({"id": fixture_id, "property_id": property_id})
    return Fixture(**updated_fixture)

@api_router.delete("/properties/{property_id}/fixtures/{fixture_id}")
async def delete_fixture(
    property_id: str,
    fixture_id: str,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    result = await db.fixtures.delete_one({"id": fixture_id, "property_id": property_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fixture not found")
    
    return {"message": "Fixture deleted successfully"}

# ============= PORTFOLIO & ASSET MANAGEMENT ENDPOINTS =============

@api_router.get("/portfolio/summary", response_model=PortfolioSummary)
async def get_portfolio_summary(user_id: str = Depends(get_current_user)):
    """Get portfolio summary with total values and counts"""
    try:
        # Helper function to safely convert to float
        def safe_float(value):
            if value is None:
                return 0.0
            try:
                return float(value)
            except (ValueError, TypeError):
                return 0.0
        
        # Get properties - use current_value or fall back to purchase_cost
        # EXCLUDE tenant properties from portfolio value calculation
        properties_cursor = db.properties.find({"user_id": user_id})
        properties = await properties_cursor.to_list(length=1000)
        properties_value = sum(
            safe_float(p.get('current_value')) or safe_float(p.get('purchase_cost', 0)) 
            for p in properties
            if p.get('ownership_type') != 'tenant'  # Exclude tenant properties
        )
        
        # Get vehicles - use current_value or fall back to purchase_cost
        vehicles_cursor = db.vehicles.find({"user_id": user_id})
        vehicles = await vehicles_cursor.to_list(length=1000)
        vehicles_value = sum(
            safe_float(v.get('current_value')) or safe_float(v.get('purchase_cost', 0)) 
            for v in vehicles
        )
        
        # Get appliances - use current_value or fall back to purchase_cost
        appliances_cursor = db.appliances.find({"user_id": user_id})
        appliances = await appliances_cursor.to_list(length=1000)
        appliances_value = sum(
            safe_float(a.get('current_value')) or safe_float(a.get('purchase_cost', 0)) 
            for a in appliances
        )
        
        # Get jewelry - use appraisal_value or fall back to purchase_cost
        jewelry_cursor = db.jewelry.find({"user_id": user_id})
        jewelry = await jewelry_cursor.to_list(length=1000)
        jewelry_value = sum(
            safe_float(j.get('appraisal_value')) or safe_float(j.get('purchase_cost', 0)) 
            for j in jewelry
        )
        
        # Get furniture - use current_value or fall back to purchase_cost
        furniture_cursor = db.furniture.find({"user_id": user_id})
        furniture = await furniture_cursor.to_list(length=1000)
        furniture_value = sum(
            safe_float(f.get('current_value')) or safe_float(f.get('purchase_cost', 0)) 
            for f in furniture
        )
        
        # Get art - use appraisal_value or fall back to current_value or purchase_cost
        art_cursor = db.art.find({"user_id": user_id})
        art = await art_cursor.to_list(length=1000)
        art_value = sum(
            safe_float(a.get('appraisal_value')) or safe_float(a.get('current_value')) or safe_float(a.get('purchase_cost', 0)) 
            for a in art
        )
        
        total = properties_value + vehicles_value + appliances_value + jewelry_value + furniture_value + art_value
        
        logger.info(f"Portfolio Summary - Properties: {properties_value}, Vehicles: {vehicles_value}, Appliances: {appliances_value}, Jewelry: {jewelry_value}, Furniture: {furniture_value}, Art: {art_value}, Total: {total}")
        
        return PortfolioSummary(
            total_value=total,
            properties_value=properties_value,
            vehicles_value=vehicles_value,
            appliances_value=appliances_value,
            jewelry_value=jewelry_value,
            furniture_value=furniture_value,
            art_value=art_value,
            properties_count=len(properties),
            vehicles_count=len(vehicles),
            appliances_count=len(appliances),
            jewelry_count=len(jewelry),
            furniture_count=len(furniture),
            art_count=len(art)
        )
    except Exception as e:
        logger.error(f"Portfolio summary error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/portfolio/details")
async def get_portfolio_details(user_id: str = Depends(get_current_user)):
    """Get detailed portfolio data including all assets for PDF export"""
    try:
        # Fetch all asset types
        properties = await db.properties.find({"user_id": user_id}).to_list(length=1000)
        vehicles = await db.vehicles.find({"user_id": user_id}).to_list(length=1000)
        appliances = await db.appliances.find({"user_id": user_id}).to_list(length=1000)
        jewelry = await db.jewelry.find({"user_id": user_id}).to_list(length=1000)
        furniture = await db.furniture.find({"user_id": user_id}).to_list(length=1000)
        art = await db.art.find({"user_id": user_id}).to_list(length=1000)
        
        # Convert ObjectId to string for JSON serialization
        for item_list in [properties, vehicles, appliances, jewelry, furniture, art]:
            for item in item_list:
                if '_id' in item:
                    item['_id'] = str(item['_id'])
        
        return {
            "properties": properties,
            "vehicles": vehicles,
            "appliances": appliances,
            "jewelry": jewelry,
            "furniture": furniture,
            "art": art
        }
    except Exception as e:
        logger.error(f"Portfolio details error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= VEHICLE ENDPOINTS =============

@api_router.post("/vehicles")
async def create_vehicle(vehicle_data: VehicleCreate, user_id: str = Depends(get_current_user)):
    """Create a new vehicle"""
    vehicle = Vehicle(user_id=user_id, **vehicle_data.dict())
    await db.vehicles.insert_one(vehicle.dict())
    return vehicle

@api_router.get("/vehicles")
async def get_vehicles(user_id: str = Depends(get_current_user)):
    """Get all vehicles for user"""
    vehicles = []
    async for doc in db.vehicles.find({"user_id": user_id}):
        doc.pop('_id', None)
        vehicles.append(doc)
    return vehicles

@api_router.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str, user_id: str = Depends(get_current_user)):
    """Get a specific vehicle"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id, "user_id": user_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle.pop('_id', None)
    return vehicle

@api_router.put("/vehicles/{vehicle_id}")
async def update_vehicle(
    vehicle_id: str,
    vehicle_data: VehicleCreate,
    user_id: str = Depends(get_current_user)
):
    """Update a vehicle"""
    result = await db.vehicles.update_one(
        {"id": vehicle_id, "user_id": user_id},
        {"$set": vehicle_data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle updated successfully"}

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, user_id: str = Depends(get_current_user)):
    """Delete a vehicle"""
    result = await db.vehicles.delete_one({"id": vehicle_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted successfully"}

@api_router.post("/vehicles/scan")
async def scan_vehicle(scan_request: VehicleScanRequest, user_id: str = Depends(get_current_user)):
    """AI scan for vehicle identification"""
    await require_ai_consent(user_id)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        import base64
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Clean base64 string - remove any data URL prefix if present
        image_data = scan_request.image
        if image_data.startswith('data:'):
            # Remove data:image/...;base64, prefix
            image_data = image_data.split(',', 1)[1] if ',' in image_data else image_data
        
        # Validate base64
        try:
            base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"Invalid base64 image: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image data")
        
        logger.info(f"Processing vehicle scan with image data length: {len(image_data)}")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"vehicle_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert in identifying vehicles from images."
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(
            text="""Analyze this vehicle image and identify it in detail.

Return ONLY a valid JSON object with this structure:
{
  "make": "BMW",
  "model": "3 Series", 
  "year": 2020,
  "color": "Blue",
  "body_type": "Sedan",
  "vin": null,
  "license_plate": null,
  "estimated_value": 25000.0,
  "confidence": 0.95
}

If any field is not visible or identifiable, set it to null. 
For confidence, use a value between 0.0 and 1.0 based on how certain you are.
Return ONLY the JSON object, no additional text.""",
            file_contents=[ImageContent(image_base64=image_data)]
        )
        
        response = await chat.send_message(user_message)
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            result = json.loads(json_str)
        else:
            result = json.loads(response)
        
        return VehicleScanResult(**result)
    except Exception as e:
        logger.error(f"Vehicle scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= APPLIANCE ENDPOINTS =============

@api_router.post("/appliances")
async def create_appliance(appliance_data: ApplianceCreate, user_id: str = Depends(get_current_user)):
    """Create a new appliance"""
    appliance = Appliance(user_id=user_id, **appliance_data.dict())
    await db.appliances.insert_one(appliance.dict())
    return appliance

@api_router.get("/appliances")
async def get_appliances(user_id: str = Depends(get_current_user)):
    """Get all appliances for user"""
    appliances = []
    async for doc in db.appliances.find({"user_id": user_id}):
        doc.pop('_id', None)
        appliances.append(doc)
    return appliances

@api_router.get("/appliances/{appliance_id}")
async def get_appliance(appliance_id: str, user_id: str = Depends(get_current_user)):
    """Get a specific appliance"""
    appliance = await db.appliances.find_one({"id": appliance_id, "user_id": user_id})
    if not appliance:
        raise HTTPException(status_code=404, detail="Appliance not found")
    appliance.pop('_id', None)
    return appliance

@api_router.put("/appliances/{appliance_id}")
async def update_appliance(
    appliance_id: str,
    appliance_data: ApplianceCreate,
    user_id: str = Depends(get_current_user)
):
    """Update an appliance"""
    result = await db.appliances.update_one(
        {"id": appliance_id, "user_id": user_id},
        {"$set": appliance_data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appliance not found")
    return {"message": "Appliance updated successfully"}

@api_router.delete("/appliances/{appliance_id}")
async def delete_appliance(appliance_id: str, user_id: str = Depends(get_current_user)):
    """Delete an appliance"""
    result = await db.appliances.delete_one({"id": appliance_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appliance not found")
    return {"message": "Appliance deleted successfully"}

# ============= JEWELRY ENDPOINTS =============

@api_router.post("/jewelry")
async def create_jewelry(jewelry_data: JewelryCreate, user_id: str = Depends(get_current_user)):
    """Create a new jewelry item"""
    jewelry = Jewelry(user_id=user_id, **jewelry_data.dict())
    await db.jewelry.insert_one(jewelry.dict())
    return jewelry

@api_router.get("/jewelry")
async def get_jewelry(user_id: str = Depends(get_current_user)):
    """Get all jewelry for user"""
    jewelry_items = []
    async for doc in db.jewelry.find({"user_id": user_id}):
        doc.pop('_id', None)
        jewelry_items.append(doc)
    return jewelry_items

@api_router.get("/jewelry/{jewelry_id}")
async def get_jewelry_item(jewelry_id: str, user_id: str = Depends(get_current_user)):
    """Get a specific jewelry item"""
    jewelry = await db.jewelry.find_one({"id": jewelry_id, "user_id": user_id})
    if not jewelry:
        raise HTTPException(status_code=404, detail="Jewelry not found")
    jewelry.pop('_id', None)
    return jewelry

@api_router.put("/jewelry/{jewelry_id}")
async def update_jewelry(
    jewelry_id: str,
    jewelry_data: JewelryCreate,
    user_id: str = Depends(get_current_user)
):
    """Update a jewelry item"""
    result = await db.jewelry.update_one(
        {"id": jewelry_id, "user_id": user_id},
        {"$set": jewelry_data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Jewelry not found")
    return {"message": "Jewelry updated successfully"}

@api_router.delete("/jewelry/{jewelry_id}")
async def delete_jewelry(jewelry_id: str, user_id: str = Depends(get_current_user)):
    """Delete a jewelry item"""
    result = await db.jewelry.delete_one({"id": jewelry_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Jewelry not found")
    return {"message": "Jewelry deleted successfully"}

@api_router.post("/jewelry/scan")
async def scan_jewelry(scan_request: ImageScanRequest, user_id: str = Depends(get_current_user)):
    """AI scan for jewelry identification"""
    await require_ai_consent(user_id)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        import base64
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Clean base64 string - remove any data URL prefix if present
        image_data = scan_request.image
        if image_data.startswith('data:'):
            # Remove data:image/...;base64, prefix
            image_data = image_data.split(',', 1)[1] if ',' in image_data else image_data
        
        # Validate base64
        try:
            base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"Invalid base64 image: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image data")
        
        logger.info(f"Processing jewelry scan with image data length: {len(image_data)}")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"jewelry_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert in identifying jewelry and gemstones."
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(
            text="""Analyze this jewelry image and identify it in detail.

Return ONLY a valid JSON object with this structure:
{
  "name": "Descriptive name (e.g., 'Diamond Engagement Ring', 'Gold Necklace')",
  "type": "Type (Ring, Necklace, Bracelet, Earrings, Watch, etc.)",
  "metal": "Metal type (Gold, Silver, Platinum, White Gold, etc.)",
  "stones": "Stones/gems description (e.g., '1 carat diamond, 2 rubies')",
  "weight": 15.5,
  "estimated_value": 5000,
  "confidence": 0.90
}

If you cannot determine a field with confidence, omit it or set it to null.
Return ONLY the JSON object, no additional text.""",
            file_contents=[ImageContent(image_base64=image_data)]
        )
        
        response = await chat.send_message(user_message)
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            result = json.loads(json_str)
        else:
            result = json.loads(response)
        
        return JewelryScanResult(**result)
    except Exception as e:
        logger.error(f"Jewelry scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= FURNITURE ENDPOINTS =============

@api_router.post("/furniture")
async def create_furniture(furniture_data: FurnitureCreate, user_id: str = Depends(get_current_user)):
    """Create a new furniture item"""
    furniture = Furniture(user_id=user_id, **furniture_data.dict())
    await db.furniture.insert_one(furniture.dict())
    return furniture

@api_router.get("/furniture")
async def get_furniture(user_id: str = Depends(get_current_user)):
    """Get all furniture for user"""
    furniture_items = []
    async for doc in db.furniture.find({"user_id": user_id}):
        doc.pop('_id', None)
        furniture_items.append(doc)
    return furniture_items

@api_router.get("/furniture/{furniture_id}")
async def get_furniture_item(furniture_id: str, user_id: str = Depends(get_current_user)):
    """Get a specific furniture item"""
    furniture = await db.furniture.find_one({"id": furniture_id, "user_id": user_id})
    if not furniture:
        raise HTTPException(status_code=404, detail="Furniture not found")
    furniture.pop('_id', None)
    return furniture

@api_router.put("/furniture/{furniture_id}")
async def update_furniture(
    furniture_id: str,
    furniture_data: FurnitureCreate,
    user_id: str = Depends(get_current_user)
):
    """Update a furniture item"""
    result = await db.furniture.update_one(
        {"id": furniture_id, "user_id": user_id},
        {"$set": furniture_data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Furniture not found")
    return {"message": "Furniture updated successfully"}

@api_router.delete("/furniture/{furniture_id}")
async def delete_furniture(furniture_id: str, user_id: str = Depends(get_current_user)):
    """Delete a furniture item"""
    result = await db.furniture.delete_one({"id": furniture_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Furniture not found")
    return {"message": "Furniture deleted successfully"}

# ============= ART ENDPOINTS =============

@api_router.post("/art")
async def create_art(art_data: ArtCreate, user_id: str = Depends(get_current_user)):
    """Create a new art item"""
    art = Art(user_id=user_id, **art_data.dict())
    await db.art.insert_one(art.dict())
    return art

@api_router.get("/art")
async def get_art(user_id: str = Depends(get_current_user)):
    """Get all art for user"""
    art_items = []
    async for doc in db.art.find({"user_id": user_id}):
        doc.pop('_id', None)
        art_items.append(doc)
    return art_items

@api_router.get("/art/{art_id}")
async def get_art_item(art_id: str, user_id: str = Depends(get_current_user)):
    """Get a specific art item"""
    art = await db.art.find_one({"id": art_id, "user_id": user_id})
    if not art:
        raise HTTPException(status_code=404, detail="Art not found")
    art.pop('_id', None)
    return art

@api_router.put("/art/{art_id}")
async def update_art(
    art_id: str,
    art_data: ArtCreate,
    user_id: str = Depends(get_current_user)
):
    """Update an art item"""
    result = await db.art.update_one(
        {"id": art_id, "user_id": user_id},
        {"$set": art_data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Art not found")
    return {"message": "Art updated successfully"}

@api_router.delete("/art/{art_id}")
async def delete_art(art_id: str, user_id: str = Depends(get_current_user)):
    """Delete an art item"""
    result = await db.art.delete_one({"id": art_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Art not found")
    return {"message": "Art deleted successfully"}

# ============= FURNITURE AI SCANNER =============

@api_router.post("/furniture/scan", response_model=FurnitureScanResult)
async def scan_furniture(scan_request: ImageScanRequest, user_id: str = Depends(get_current_user)):
    """AI scan furniture from image"""
    await require_ai_consent(user_id)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        import base64
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Clean base64 string - remove any data URL prefix if present
        image_data = scan_request.image
        if image_data.startswith('data:'):
            # Remove data:image/...;base64, prefix
            image_data = image_data.split(',', 1)[1] if ',' in image_data else image_data
        
        # Validate base64
        try:
            base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"Invalid base64 image: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image data")
        
        logger.info(f"Processing furniture scan with image data length: {len(image_data)}")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"furniture_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert in furniture identification and appraisal."
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(
            text="""Analyze this furniture image and extract the following information in JSON format:
{
  "name": "Descriptive name of the furniture piece",
  "category": "Sofa/Table/Chair/Bed/Cabinet/Desk/Shelf/Wardrobe/Other",
  "brand": "Brand name if visible or identifiable",
  "material": "Primary material (Wood/Metal/Fabric/Leather/Glass/Plastic/Mixed/Other)",
  "style": "Design style (Modern/Contemporary/Traditional/Vintage/Industrial/Scandinavian/etc)",
  "estimated_age": "Approximate age or era (New/5-10 years/Vintage/Antique)",
  "condition": "Excellent/Good/Fair/Poor based on visible condition",
  "confidence": 0.85
}

Provide your best assessment based on visible features, construction, design elements, and any visible branding or labels.
Return ONLY the JSON object, no additional text.""",
            file_contents=[ImageContent(image_base64=image_data)]
        )
        
        response = await chat.send_message(user_message)
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            result = json.loads(json_str)
        else:
            result = json.loads(response)
        
        return FurnitureScanResult(**result)
    except Exception as e:
        logger.error(f"Furniture scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= ART AI SCANNER =============

@api_router.post("/art/scan", response_model=ArtScanResult)
async def scan_art(scan_request: ImageScanRequest, user_id: str = Depends(get_current_user)):
    """AI scan art from image"""
    await require_ai_consent(user_id)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        import base64
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Clean base64 string - remove any data URL prefix if present
        image_data = scan_request.image
        if image_data.startswith('data:'):
            # Remove data:image/...;base64, prefix
            image_data = image_data.split(',', 1)[1] if ',' in image_data else image_data
        
        # Validate base64
        try:
            base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"Invalid base64 image: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image data")
        
        logger.info(f"Processing art scan with image data length: {len(image_data)}")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"art_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert art historian and analyst specializing in identifying and analyzing artwork."
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(
            text="""Analyze this artwork image and extract the following information in JSON format:
{
  "name": "Title or descriptive name of the artwork",
  "type": "Painting/Sculpture/Print/Photograph/Drawing/Collage/Digital Art/Mixed Media/Other",
  "artist": "Artist name if identifiable from signature or style",
  "medium": "Medium used (Oil/Acrylic/Watercolor/Bronze/Marble/Canvas/Paper/Digital/etc)",
  "style": "Art style or movement (Impressionism/Abstract/Realism/Contemporary/etc)",
  "estimated_period": "Time period or era (Contemporary/Modern/20th Century/19th Century/etc)",
  "subject_matter": "Brief description of what the artwork depicts",
  "confidence": 0.85
}

Provide your best assessment based on visible artistic elements, technique, composition, and any visible signatures or markings.
Return ONLY the JSON object, no additional text.""",
            file_contents=[ImageContent(image_base64=image_data)]
        )
        
        response = await chat.send_message(user_message)
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            result = json.loads(json_str)
        else:
            result = json.loads(response)
        
        return ArtScanResult(**result)
    except Exception as e:
        logger.error(f"Art scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= FURNITURE RECEIPT SCANNER =============

@api_router.post("/furniture/scan-receipt", response_model=ReceiptScanResult)
async def scan_furniture_receipt(
    scan_request: ReceiptScanRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Use Gemini Vision AI to extract furniture purchase information from receipt/invoice images
    """
    await require_ai_consent(user_id)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"furniture_receipt_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert at extracting furniture purchase information from receipts and invoices."
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(
            text="""Analyze this furniture receipt/invoice image and extract all relevant purchase information.

IMPORTANT: This may be an Indian receipt with DD/MM/YYYY date format, rupee currency (₹), and GST details.

Instructions:
- For dates in DD/MM/YYYY format, convert to YYYY-MM-DD format
- If multiple furniture items are listed, focus on the PRIMARY/MAIN item (usually the most expensive or first major item)
- Extract warranty information from any warranty cards, terms, or product details visible
- For Indian receipts, look for: Furniture name, Brand, Model/SKU, Material, MRP/Price, GST details
- Convert any Indian rupee amounts (₹) to numeric format without currency symbol
- Look for warranty period mentions like "1 year", "2 years", "6 months" etc.
- Extract furniture-specific details like material, dimensions if visible

Return ONLY a valid JSON object with this exact structure.

CRITICAL: Use null (not "unknown", "N/A", "not visible", or empty string) for any field you cannot confidently identify:
{
  "vendor_name": "Store or vendor name (e.g., IKEA, Pepperfry, Urban Ladder) OR null",
  "purchase_date": "YYYY-MM-DD format date (convert from DD/MM/YYYY if needed) OR null",
  "item_name": "Furniture item name (e.g., 'Sofa Set', 'Dining Table') OR null",
  "item_description": "Brief description including material, dimensions if visible OR null",
  "brand": "Brand name OR null",
  "model": "Model number, SKU, or product code if visible OR null",
  "serial_number": null,
  "purchase_cost": 0.00,
  "warranty_info": "Warranty details if mentioned (e.g., '1 year manufacturer warranty') OR null",
  "warranty_months": 0,
  "confidence": 0.95
}

IMPORTANT: For serial_number specifically - ONLY include if you can clearly see it on the receipt. Most furniture receipts do NOT have serial numbers. Use null if not present.

Examples:
- If date shows "30/10/2025", convert to "2025-10-30"
- If price shows "₹45,900", extract as 45900.00
- If item is "3-Seater Fabric Sofa" with brand "Urban Ladder", extract brand as "Urban Ladder" and item_name as "3-Seater Fabric Sofa"
- If warranty shows "2 years", set warranty_months to 24

Be precise with extracted values. Set confidence between 0.0 and 1.0 based on image quality and visibility of information.""",
            file_contents=[ImageContent(image_base64=scan_request.image)]
        )
        
        response = await chat.send_message(user_message)
        
        try:
            # Try to extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                result_data = json.loads(json_str)
                return ReceiptScanResult(**result_data)
            else:
                raise ValueError("No JSON found in response")
                
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse receipt scan response: {str(e)}")
            logger.error("AI response could not be parsed")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to parse receipt data. Please ensure the image is clear and contains a valid receipt."
            )
    except Exception as e:
        logger.error(f"Furniture receipt scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= UNIVERSAL ASSET IDENTIFIER =============

@api_router.post("/identify-asset")
async def identify_asset(scan_request: ImageScanRequest, user_id: str = Depends(get_current_user)):
    """AI-powered universal asset identifier"""
    await require_ai_consent(user_id)
    try:
        image_base64 = scan_request.image
        
        prompt = """Analyze this image and identify what type of asset it is. 
        
        Respond ONLY with a JSON object in this exact format:
        {
          "asset_type": "one of: vehicle, appliance, jewelry, furniture, art, property, other",
          "description": "brief description of the item",
          "confidence": 0.95
        }
        
        Be specific about the asset_type. Examples:
        - Car, motorcycle, bicycle → "vehicle"
        - TV, refrigerator, washing machine → "appliance"
        - Ring, necklace, earrings → "jewelry"
        - Sofa, table, chair, bed → "furniture"
        - Painting, sculpture, artwork → "art"
        - Building, house → "property"
        
        Choose the most appropriate category."""

        genai.configure(api_key=EMERGENT_LLM_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash-exp")
        
        response = model.generate_content([
            prompt,
            {
                "mime_type": "image/jpeg",
                "data": image_base64
            }
        ])
        
        result_text = response.text.strip()
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        result_text = result_text.strip()
        
        result = json.loads(result_text)
        
        return result
    except Exception as e:
        logger.error(f"Asset identification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= RECEIPT SCANNER ENDPOINT =============

@api_router.post("/scan-receipt", response_model=ReceiptScanResult)
async def scan_receipt(
    scan_request: ReceiptScanRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Use Gemini Vision AI to extract information from receipt/invoice images
    """
    await require_ai_consent(user_id)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"receipt_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert at extracting information from receipts and invoices."
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(
            text="""Analyze this receipt/invoice image and extract all relevant purchase information.

IMPORTANT: This may be an Indian receipt with DD/MM/YYYY date format, rupee currency (₹), and GST details.

Instructions:
- For dates in DD/MM/YYYY format, convert to YYYY-MM-DD format
- If multiple items are listed, focus on the PRIMARY/MAIN item (usually the most expensive or first major item)
- Extract warranty information from any warranty cards, terms, or product details visible
- For Indian receipts, look for: Product name, Brand, Model number, Serial number, MRP/Price, GST details
- Convert any Indian rupee amounts (₹) to numeric format without currency symbol
- Look for warranty period mentions like "1 year", "2 years", "6 months" etc.

Return ONLY a valid JSON object with this exact structure.

CRITICAL: Use null (not "unknown", "N/A", "not visible", or empty string) for any field you cannot confidently identify:
{
  "vendor_name": "Store or vendor name (e.g., Reliance Digital, Amazon, Flipkart) OR null if not visible",
  "purchase_date": "YYYY-MM-DD format date (convert from DD/MM/YYYY if needed) OR null if not visible",
  "item_name": "Main product name (focus on the primary expensive item if multiple) OR null if not visible",
  "item_description": "Brief description including model details OR null if not visible",
  "brand": "Brand name (e.g., Apple, Samsung, LG) OR null if not visible",
  "model": "Model number or code (e.g., MBA-13 MW133HN A) OR null if not visible",
  "serial_number": null,
  "purchase_cost": 0.00,
  "warranty_info": "Warranty details if mentioned (e.g., '1 year manufacturer warranty') OR null if not visible",
  "warranty_months": 0,
  "confidence": 0.95
}

IMPORTANT: For serial_number specifically - ONLY include if you can clearly see it on the receipt. Most receipts do NOT have serial numbers. Use null if not present.

Examples:
- If date shows "30/10/2025", convert to "2025-10-30"
- If price shows "₹119,900", extract as 119900.00
- If item is "MBA-13 MW133HN A" with brand context, extract brand as "Apple" and model as "MBA-13 MW133HN A"
- If warranty shows "1 year", set warranty_months to 12

Be precise with extracted values. Set confidence between 0.0 and 1.0 based on image quality and visibility of information.""",
            file_contents=[ImageContent(image_base64=scan_request.image)]
        )
        
        response = await chat.send_message(user_message)
        
        try:
            # Try to extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
            else:
                result = json.loads(response)
            
            return ReceiptScanResult(**result)
            
        except json.JSONDecodeError as je:
            logger.error(f"JSON parsing error: {str(je)}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Receipt scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= APPLIANCE SCANNER ENDPOINT =============

@api_router.post("/fixtures/scan-appliance", response_model=ApplianceScanResult)
async def scan_appliance(
    scan_request: ApplianceScanRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Use Gemini Vision AI via emergentintegrations to identify appliance from image
    """
    await require_ai_consent(user_id)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        import base64
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Clean base64 string - remove any data URL prefix if present
        image_data = scan_request.image
        if image_data.startswith('data:'):
            # Remove data:image/...;base64, prefix
            image_data = image_data.split(',', 1)[1] if ',' in image_data else image_data
        
        # Validate base64
        try:
            base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"Invalid base64 image: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image data")
        
        logger.info(f"Processing appliance scan with image data length: {len(image_data)}")
        
        # Initialize LLM chat with Gemini vision model (same as Vastu endpoint)
        chat = LlmChat(
            api_key=api_key,
            session_id=f"appliance_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert in identifying home appliances and electrical fixtures."
        ).with_model("gemini", "gemini-2.0-flash")
        
        # Create message with image
        user_message = UserMessage(
            text="""Analyze this image and identify the appliance or electrical fixture. 
            
CRITICAL: Use null (not "unknown", "N/A", "not visible", or empty string) for any field you cannot confidently identify.

Return ONLY a valid JSON object with this structure:
{
  "name": "Specific name (e.g., 'Ceiling Fan', 'LED TV', 'Refrigerator') OR null",
  "category": "Category (lights, fans, electrical appliances) OR null",
  "make": "Brand name if visible (e.g., 'Samsung', 'LG', 'Crompton') OR null",
  "model": "Model number if visible OR null",
  "serial_number": null,
  "confidence": 0.95
}

IMPORTANT: 
- For serial_number specifically - ONLY include if you can CLEARLY see it in the image. Serial numbers are rarely visible in photos. Use null if not clearly visible.
- If you can't identify the item clearly, set confidence lower.
- Never use "unknown", "N/A", "not visible" - always use null for missing fields.

Return ONLY the JSON object, no additional text.""",
            file_contents=[ImageContent(image_base64=image_data)]
        )
        
        # Get AI response (LlmChat returns string directly)
        response_text = await chat.send_message(user_message)
        logger.debug("Appliance scan completed")
        
        # Parse JSON response
        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                result = json.loads(json_str)
            else:
                result = json.loads(response_text)
            
            return ApplianceScanResult(**result)
            
        except json.JSONDecodeError as je:
            logger.error(f"JSON parsing error: {str(je)}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Appliance scan error: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to scan appliance: {str(e)}")

# ============= GOOGLE PLACES PROXY ENDPOINT =============

@api_router.get("/places/nearby")
async def get_nearby_places(
    lat: float,
    lon: float,
    radius: int = 2000,
    place_type: str = "hospital",
    user_id: str = Depends(get_current_user)
):
    """
    Proxy endpoint for Google Places API to avoid CORS issues on web
    """
    try:
        import httpx
        
        api_key = os.environ.get('GOOGLE_MAPS_API_KEY', '')
        if not api_key:
            raise HTTPException(status_code=500, detail="Google Maps API key not configured")
        
        url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            "location": f"{lat},{lon}",
            "radius": radius,
            "type": place_type,
            "key": api_key
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            return response.json()
            
    except httpx.HTTPError as e:
        logger.error(f"Google Places API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch places: {str(e)}")
    except Exception as e:
        logger.error(f"Nearby places error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/places/autocomplete")
async def get_places_autocomplete(
    input: str,
    user_id: str = Depends(get_current_user)
):
    """
    Proxy endpoint for Google Places Autocomplete API to avoid CORS issues on web
    """
    try:
        import httpx
        
        api_key = os.environ.get('GOOGLE_MAPS_API_KEY', '')
        if not api_key:
            raise HTTPException(status_code=500, detail="Google Maps API key not configured")
        
        url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
        params = {
            "input": input,
            "key": api_key
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            return response.json()
            
    except httpx.HTTPError as e:
        logger.error(f"Google Places Autocomplete API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch autocomplete: {str(e)}")
    except Exception as e:
        logger.error(f"Places autocomplete error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/places/details")
async def get_place_details(
    place_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Proxy endpoint for Google Places Details API to avoid CORS issues on web
    """
    try:
        import httpx
        
        api_key = os.environ.get('GOOGLE_MAPS_API_KEY', '')
        if not api_key:
            raise HTTPException(status_code=500, detail="Google Maps API key not configured")
        
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            "place_id": place_id,
            "key": api_key
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            return response.json()
            
    except httpx.HTTPError as e:
        logger.error(f"Google Places Details API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch place details: {str(e)}")
    except Exception as e:
        logger.error(f"Place details error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/places/reverse-geocode")
async def reverse_geocode(
    lat: float,
    lng: float,
    user_id: str = Depends(get_current_user)
):
    """
    Reverse geocode coordinates to get address using Google Geocoding API
    """
    try:
        import httpx
        
        api_key = os.environ.get('GOOGLE_MAPS_API_KEY', '')
        if not api_key:
            raise HTTPException(status_code=500, detail="Google Maps API key not configured")
        
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "latlng": f"{lat},{lng}",
            "key": api_key
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            # Extract formatted address from first result
            if data.get('results') and len(data['results']) > 0:
                address = data['results'][0].get('formatted_address', '')
                return {"address": address, "results": data['results']}
            else:
                return {"address": "", "results": []}
            
    except httpx.HTTPError as e:
        logger.error(f"Google Geocoding API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reverse geocode: {str(e)}")
    except Exception as e:
        logger.error(f"Reverse geocode error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= PAINT ESTIMATION ENDPOINTS =============

@api_router.post("/paint-estimation/analyze-wall", response_model=PaintEstimate)
async def analyze_wall_for_painting(
    scan_request: WallScanRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Use Gemini Vision AI to estimate wall dimensions and calculate paint requirements
    """
    await require_ai_consent(user_id)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"wall_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert in analyzing room dimensions and calculating paint requirements."
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(
            text="""Analyze this room image and estimate the wall dimensions.

Return ONLY a valid JSON object with this structure:
{
  "walls": [
    {
      "wall_width": 12.0,
      "wall_height": 9.0,
      "doors": 1,
      "windows": 2
    }
  ]
}

Instructions:
- Estimate dimensions in feet
- Count all visible doors (standard door = 20 sq ft)
- Count all visible windows (standard window = 15 sq ft)
- If you see multiple walls, include all of them
- Provide realistic estimates based on standard room sizes

Return ONLY the JSON object, no additional text.""",
            file_contents=[ImageContent(image_base64=scan_request.image)]
        )
        
        response = await chat.send_message(user_message)
        logger.debug("Wall scan completed")
        
        # Parse JSON response
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                wall_data = json.loads(json_str)
            else:
                wall_data = json.loads(response)
            
            # Calculate paint requirements
            total_wall_area = 0
            door_area = 0
            window_area = 0
            
            for wall in wall_data['walls']:
                wall_area = wall['wall_width'] * wall['wall_height']
                total_wall_area += wall_area
                door_area += wall.get('doors', 0) * 20  # 20 sq ft per door
                window_area += wall.get('windows', 0) * 15  # 15 sq ft per window
            
            paintable_area = total_wall_area - door_area - window_area
            
            # Calculate paint needed (350 sq ft per gallon, 2 coats)
            paint_gallons = (paintable_area * 2) / 350
            
            # Mock vendor quotes ($25-40 per gallon + labor)
            paint_cost = paint_gallons * 35  # Average paint cost
            labor_cost_low = paintable_area * 1.5  # $1.5 per sq ft
            labor_cost_high = paintable_area * 2.5  # $2.5 per sq ft
            
            estimated_cost_low = paint_cost + labor_cost_low
            estimated_cost_high = paint_cost + labor_cost_high
            
            return PaintEstimate(
                total_wall_area=round(total_wall_area, 2),
                paintable_area=round(paintable_area, 2),
                paint_gallons_needed=round(paint_gallons, 2),
                estimated_cost_low=round(estimated_cost_low, 2),
                estimated_cost_high=round(estimated_cost_high, 2),
                walls=[WallDimensions(**wall) for wall in wall_data['walls']]
            )
            
        except json.JSONDecodeError as je:
            logger.error(f"JSON parsing error: {str(je)}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Wall scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/paint-estimation/analyze-room")
async def analyze_room_for_painting(
    room_data: dict,
    user_id: str = Depends(get_current_user)
):
    """
    Analyze multiple wall images and optional ceiling for complete room painting estimation
    """
    await require_ai_consent(user_id)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        wall_images = room_data.get('wall_images', [])
        ceiling_image = room_data.get('ceiling_image')
        include_ceiling = room_data.get('include_ceiling', False)
        
        if not wall_images:
            raise HTTPException(status_code=400, detail="At least one wall image is required")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"room_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert in analyzing room dimensions and calculating complete room paint requirements."
        ).with_model("gemini", "gemini-2.0-flash")
        
        # Prepare image contents
        image_contents = [ImageContent(image_base64=img) for img in wall_images]
        if ceiling_image:
            image_contents.append(ImageContent(image_base64=ceiling_image))
        
        prompt_text = f"""Analyze these {len(wall_images)} wall images{' and ceiling image' if ceiling_image else ''} from a single room.

Return ONLY a valid JSON object with this structure:
{{
  "walls": [
    {{
      "wall_width": 12.0,
      "wall_height": 10.0,
      "doors": 1,
      "windows": 2
    }}
  ],
  "ceiling_width": 12.0,
  "ceiling_length": 14.0
}}

Instructions:
- Analyze each wall image separately
- Estimate dimensions in feet (walls can be 8-15 feet tall)
- Count doors (standard door = 20 sq ft)
- Count windows (standard window = 15 sq ft)
- For ceiling, estimate room dimensions
- Be accurate with tall walls (10-15 feet)
- Provide realistic measurements

Return ONLY the JSON object, no additional text."""
        
        user_message = UserMessage(
            text=prompt_text,
            file_contents=image_contents
        )
        
        response = await chat.send_message(user_message)
        logger.debug("Room scan completed")
        
        # Parse JSON response
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                room_data_parsed = json.loads(json_str)
            else:
                room_data_parsed = json.loads(response)
            
            # Calculate wall painting
            total_wall_area = 0
            door_area = 0
            window_area = 0
            
            for wall in room_data_parsed.get('walls', []):
                wall_area = wall['wall_width'] * wall['wall_height']
                total_wall_area += wall_area
                door_area += wall.get('doors', 0) * 20
                window_area += wall.get('windows', 0) * 15
            
            paintable_wall_area = total_wall_area - door_area - window_area
            
            # Calculate ceiling painting
            ceiling_area = 0
            paintable_ceiling_area = 0
            if include_ceiling and ceiling_image:
                ceiling_width = room_data_parsed.get('ceiling_width', 0)
                ceiling_length = room_data_parsed.get('ceiling_length', 0)
                ceiling_area = ceiling_width * ceiling_length
                paintable_ceiling_area = ceiling_area  # Ceilings usually have no obstructions
            
            # Total paintable area
            total_paintable_area = paintable_wall_area + paintable_ceiling_area
            
            # Calculate paint needed (350 sq ft per gallon, 2 coats)
            paint_gallons = (total_paintable_area * 2) / 350
            
            # Calculate costs
            paint_cost = paint_gallons * 35
            labor_cost_low = total_paintable_area * 1.5
            labor_cost_high = total_paintable_area * 2.5
            
            estimated_cost_low = paint_cost + labor_cost_low
            estimated_cost_high = paint_cost + labor_cost_high
            
            return {
                "total_wall_area": round(total_wall_area, 2),
                "ceiling_area": round(ceiling_area, 2),
                "paintable_wall_area": round(paintable_wall_area, 2),
                "paintable_ceiling_area": round(paintable_ceiling_area, 2),
                "total_paintable_area": round(total_paintable_area, 2),
                "paint_gallons_needed": round(paint_gallons, 2),
                "estimated_cost_low": round(estimated_cost_low, 2),
                "estimated_cost_high": round(estimated_cost_high, 2),
                "walls": room_data_parsed.get('walls', [])
            }
            
        except json.JSONDecodeError as je:
            logger.error(f"JSON parsing error: {str(je)}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Room scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/properties/{property_id}/paint-estimations")
async def save_paint_estimation(
    property_id: str,
    estimation_data: dict,
    user_id: str = Depends(get_current_user)
):
    """Save paint estimation for a property"""
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    estimation = PaintEstimation(
        property_id=property_id,
        **estimation_data
    )
    
    await db.paint_estimations.insert_one(estimation.dict())
    return estimation

@api_router.get("/properties/{property_id}/paint-estimations")
async def get_paint_estimations(
    property_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get all paint estimations for a property"""
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    estimations = []
    async for doc in db.paint_estimations.find({"property_id": property_id}):
        doc.pop('_id', None)
        estimations.append(doc)
    
    return estimations

# ============= MEASUREMENT ENDPOINTS =============

@api_router.post("/properties/{property_id}/measurements", response_model=Measurement)
async def create_measurement(
    property_id: str,
    measurement: MeasurementCreate,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    measurement_obj = Measurement(
        property_id=property_id,
        **measurement.dict()
    )
    await db.measurements.insert_one(measurement_obj.dict())
    return measurement_obj

@api_router.get("/properties/{property_id}/measurements", response_model=List[Measurement])
async def get_measurements(property_id: str, user_id: str = Depends(get_current_user)):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    measurements = await db.measurements.find({"property_id": property_id}).to_list(1000)
    return [Measurement(**m) for m in measurements]

@api_router.get("/properties/{property_id}/measurements/{measurement_id}", response_model=Measurement)
async def get_measurement(
    property_id: str,
    measurement_id: str,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    measurement_doc = await db.measurements.find_one({"id": measurement_id, "property_id": property_id})
    if not measurement_doc:
        raise HTTPException(status_code=404, detail="Measurement not found")
    
    return Measurement(**measurement_doc)

@api_router.put("/properties/{property_id}/measurements/{measurement_id}", response_model=Measurement)
async def update_measurement(
    property_id: str,
    measurement_id: str,
    measurement: MeasurementCreate,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Update measurement
    update_data = measurement.dict(exclude_unset=True)
    result = await db.measurements.update_one(
        {"id": measurement_id, "property_id": property_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Measurement not found")
    
    # Return updated measurement
    updated_measurement = await db.measurements.find_one({"id": measurement_id, "property_id": property_id})
    return Measurement(**updated_measurement)

@api_router.delete("/properties/{property_id}/measurements/{measurement_id}")
async def delete_measurement(
    property_id: str,
    measurement_id: str,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    result = await db.measurements.delete_one({"id": measurement_id, "property_id": property_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Measurement not found")
    
    return {"message": "Measurement deleted successfully"}

# ============= NOTIFICATION ENDPOINTS =============

@api_router.get("/notifications")
async def get_notifications(user_id: str = Depends(get_current_user)):
    notifications = await db.notifications.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    return [Notification(**n) for n in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user_id: str = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user_id},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

@api_router.post("/notifications/check-warranties")
async def check_warranty_expiries(user_id: str = Depends(get_current_user)):
    """Check for warranty expiries and create notifications"""
    # Get user settings
    user_doc = await db.users.find_one({"id": user_id})
    reminder_days = user_doc.get("warranty_reminder_days", 30)
    
    # Get all user's properties
    properties = await db.properties.find({"user_id": user_id}).to_list(1000)
    property_ids = [p["id"] for p in properties]
    
    # Get all fixtures with warranty expiry dates
    fixtures = await db.fixtures.find({
        "property_id": {"$in": property_ids},
        "warranty_expiry_date": {"$ne": None}
    }).to_list(1000)
    
    notifications_created = 0
    today = datetime.utcnow()
    target_date = today + timedelta(days=reminder_days)
    
    for fixture in fixtures:
        try:
            # Try to parse the date - handle multiple formats
            date_str = fixture["warranty_expiry_date"]
            
            # Try ISO format first
            try:
                expiry_date = datetime.fromisoformat(date_str)
            except (ValueError, TypeError):
                # Try MM/DD/YYYY format
                try:
                    from datetime import datetime as dt
                    expiry_date = dt.strptime(date_str, "%m/%d/%Y")
                except (ValueError, TypeError):
                    # Try YYYY-MM-DD format
                    try:
                        expiry_date = dt.strptime(date_str, "%Y-%m-%d")
                    except (ValueError, TypeError):
                        # Skip this fixture if date format is unrecognized
                        logger.warning(f"Could not parse warranty date for fixture {fixture['id']}: {date_str}")
                        continue
            
            days_until_expiry = (expiry_date - today).days
            
            # Check if we should create a notification
            if 0 <= days_until_expiry <= reminder_days:
                # Check if notification already exists
                existing = await db.notifications.find_one({
                    "user_id": user_id,
                    "fixture_id": fixture["id"],
                    "type": "warranty_expiry"
                })
                
                if not existing:
                    notification = Notification(
                        user_id=user_id,
                        property_id=fixture["property_id"],
                        fixture_id=fixture["id"],
                        fixture_name=fixture["name"],
                        title="Warranty Expiring Soon",
                        message=f"The warranty for {fixture['name']} expires in {days_until_expiry} days on {expiry_date.strftime('%Y-%m-%d')}.",
                        type="warranty_expiry"
                    )
                    await db.notifications.insert_one(notification.dict())
                    notifications_created += 1
        except Exception as e:
            logger.error(f"Error processing fixture {fixture.get('id', 'unknown')}: {str(e)}")
            continue
    
    return {"message": f"Created {notifications_created} warranty notifications"}

# ============= AI FLOOR PLAN ANALYSIS =============

@api_router.post("/measurements/analyze-floorplan")
async def analyze_floorplan(
    analysis_data: FloorPlanAnalysis,
    user_id: str = Depends(get_current_user)
):
    await require_ai_consent(user_id)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        # Get API key
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Initialize LLM chat with vision model
        chat = LlmChat(
            api_key=api_key,
            session_id=f"floorplan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert in analyzing architectural floor plans and extracting room dimensions. Analyze the floor plan image and extract dimensions for different rooms."
        ).with_model("openai", "gpt-4o")
        
        # Create message with image
        user_message = UserMessage(
            text="""Analyze this floor plan image and extract the dimensions for the following room types if present:
            - Master Bedroom
            - Living Area
            - Kitchen
            - Bathrooms
            - Dining Area
            
            For each room found, provide:
            1. Room type
            2. Length (if visible)
            3. Width (if visible)
            4. Any notes about the measurements
            
            Return the information in a structured format. If measurements are not clearly visible, indicate that in the notes.""",
            file_contents=[ImageContent(image_base64=analysis_data.floor_plan_image)]
        )
        
        # Get AI response
        response = await chat.send_message(user_message)
        
        return {
            "analysis": response,
            "message": "Floor plan analyzed successfully. Please review the extracted dimensions and create measurements manually."
        }
        
    except Exception as e:
        logger.error(f"Error analyzing floor plan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing floor plan: {str(e)}")

@api_router.post("/measurements/analyze-floorplan-comprehensive", response_model=ComprehensiveFloorPlanAnalysis)
async def analyze_floorplan_comprehensive(
    analysis_data: FloorPlanAnalysis,
    user_id: str = Depends(get_current_user)
):
    """
    Comprehensive multi-floor plan analysis using Gemini 2.0 Flash.
    Extracts house type, number of rooms, and detailed measurements for each room across all floors.
    """
    await require_ai_consent(user_id)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        
        # Get API key
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Initialize LLM chat with Gemini 2.0 Flash
        chat = LlmChat(
            api_key=api_key,
            session_id=f"comprehensive_floorplan_{user_id}_{uuid.uuid4()}",
            system_message="""You are an expert architectural analyst specializing in floor plan analysis. 
            Your task is to analyze floor plans (potentially multiple floors) and extract comprehensive information about the property."""
        ).with_model("gemini", "gemini-2.0-flash")
        
        # Prepare image contents with floor information
        image_contents = []
        floor_info_text = ""
        
        for floor_plan in analysis_data.floor_plans:
            image_contents.append(ImageContent(image_base64=floor_plan.image))
            floor_info_text += f"\n- Floor {floor_plan.floor_number} plan image attached"
        
        # Create comprehensive analysis prompt
        prompt_text = f"""Analyze these floor plan images comprehensively. There are {len(analysis_data.floor_plans)} floor(s) in this property.
{floor_info_text}

Provide the following information in JSON format:

1. **House Type Classification**: Identify the type of property from these categories:
   - "Studio" (single open space)
   - "1 BHK Apartment", "2 BHK Apartment", "3 BHK Apartment", "4 BHK Apartment", etc. (based on bedroom count)
   - "Villa"
   - "Duplex"
   - "Bungalow"

2. **Room Count Summary**:
   - Total number of bedrooms (across all floors)
   - Total number of bathrooms (across all floors)
   - Total number of rooms overall

3. **Individual Room Analysis**: For EACH room visible in ALL floor plans, provide:
   - room_name: Specific name (e.g., "Master Bedroom", "Bedroom 2", "Living Room", "Kitchen", "Bathroom 1")
   - room_type: Category (master_bedroom, bedroom, living_area, kitchen, bathroom, dining_area, balcony, utility, study, etc.)
   - floor_number: Which floor this room is on (1, 2, 3, etc.) - IMPORTANT: Match to the image number provided
   - length: Length in feet (if visible/measurable)
   - width: Width in feet (if visible/measurable)
   - area: Area in square feet (if calculable or mentioned)
   - ceiling_height: Height in feet (if visible)
   - windows: Number of windows (if visible)
   - notes: Any additional observations (e.g., "attached bathroom", "has wardrobe", "open to balcony")

Return ONLY a valid JSON object with this exact structure:
{{
  "house_type": "string",
  "total_bedrooms": number,
  "total_bathrooms": number,
  "total_rooms": number,
  "total_floors": {len(analysis_data.floor_plans)},
  "rooms": [
    {{
      "room_name": "string",
      "room_type": "string",
      "floor_number": number,
      "length": number or null,
      "width": number or null,
      "area": number or null,
      "ceiling_height": number or null,
      "windows": number or null,
      "notes": "string or null"
    }}
  ],
  "overall_notes": "string or null"
}}

Important:
- Be thorough and analyze ALL visible rooms across ALL floors
- Correctly assign floor_number to each room based on which image it appears in
- If dimensions are marked on the floor plan, extract them accurately
- If dimensions are not visible, estimate based on standard room sizes and proportions
- Provide realistic measurements (bedrooms: 10-15 ft, living rooms: 12-20 ft, kitchens: 8-12 ft, bathrooms: 5-8 ft)
- Return ONLY the JSON object, no additional text"""
        
        user_message = UserMessage(
            text=prompt_text,
            file_contents=image_contents
        )
        
        # Get AI response
        response = await chat.send_message(user_message)
        logger.debug("Floor plan analysis completed")
        
        # Parse the JSON response
        try:
            # Try to find JSON in the response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                analysis_result = json.loads(json_str)
            else:
                # If no JSON found, try parsing the entire response
                analysis_result = json.loads(response)
            
            # Validate and create the response model
            return ComprehensiveFloorPlanAnalysis(**analysis_result)
            
        except json.JSONDecodeError as je:
            logger.error("AI response could not be parsed")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to parse AI response. Please try again or upload clearer floor plan images."
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in comprehensive floor plan analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing floor plan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing floor plan: {str(e)}")

# ============= VASTU ANALYSIS ENDPOINTS =============

@api_router.post("/properties/{property_id}/vastu", response_model=VastuAnalysis)
async def create_vastu_analysis(
    property_id: str,
    vastu_data: VastuAnalysisCreate,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    await require_ai_consent(user_id)
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    geomancy_type = vastu_data.geomancy_type or "vastu"
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        # Get API key
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Different prompts and system messages for Vastu vs Feng Shui
        if geomancy_type == "feng_shui":
            system_message = """You are an expert in Feng Shui, the ancient Chinese practice of harmonizing individuals with their surrounding environment. Analyze floor plans for Feng Shui principles and provide detailed recommendations."""
            
            analysis_prompt = """Analyze this floor plan according to Feng Shui principles. Please provide:

1. **Overall Feng Shui Score** (0-100): Rate the overall harmony and chi flow

2. **Bagua Map Analysis**: Overlay the Bagua map on this floor plan and analyze each area:
   - Wealth & Prosperity (Southeast)
   - Fame & Reputation (South)
   - Love & Relationships (Southwest)
   - Family & Health (East)
   - Center (Tai Chi)
   - Children & Creativity (West)
   - Knowledge & Self-Cultivation (Northeast)
   - Career & Life Path (North)
   - Helpful People & Travel (Northwest)

3. **Chi Flow Assessment**:
   - Entrance and chi entry points
   - Flow of energy through the space
   - Areas of stagnant or rushed chi
   - Balance of yin and yang energies

4. **Five Elements Analysis** (Wood, Fire, Earth, Metal, Water):
   - Current element distribution
   - Element balance in each room
   - Missing or excessive elements

5. **Key Observations**:
   - Positive Feng Shui features
   - Problem areas or energy blockages
   - Command positions for beds and desks

6. **Detailed Recommendations**:
   - Placement of furniture for optimal chi flow
   - Color schemes based on five elements
   - Remedies for problem areas (mirrors, crystals, plants, etc.)
   - Enhancements for specific life areas using Bagua

7. **Priority Actions**: List 3-5 most important changes to improve Feng Shui

Please be specific and practical in your recommendations."""
        else:  # vastu
            system_message = """You are an expert in Vastu Shastra, the ancient Indian science of architecture and spatial design. Analyze floor plans for Vastu compliance and provide detailed recommendations."""
            
            analysis_prompt = """Analyze this floor plan according to Vastu Shastra principles. Please provide:

1. **Overall Vastu Compliance Score** (0-100): Rate the overall adherence to Vastu principles

2. **Direction Analysis**: Analyze the placement of rooms based on cardinal directions
   - Main entrance direction and its significance
   - Master bedroom placement (ideally South-West)
   - Kitchen placement (ideally South-East - Agni corner)
   - Pooja/Prayer room (ideally North-East - Ishanya corner)
   - Bathrooms and toilets placement
   - Living room placement (ideally North or East)
   - Dining area (ideally West or North-West)

3. **Five Elements (Pancha Mahabhuta) Analysis**:
   - Earth (Prithvi) - Southwest
   - Water (Jal) - Northeast
   - Fire (Agni) - Southeast
   - Air (Vayu) - Northwest
   - Space (Akasha) - Center (Brahmasthan)

4. **Energy Flow Assessment**:
   - Positive energy zones
   - Areas of concern or doshas (defects)
   - Brahmasthan (center) analysis

5. **Key Observations**:
   - Positive aspects that align with Vastu
   - Areas of non-compliance or Vastu doshas
   - Impact on health, wealth, and prosperity

6. **Detailed Recommendations**:
   - Specific corrections or remedies for doshas
   - Color recommendations for different rooms based on directions
   - Placement of furniture and fixtures
   - Remedial measures (yantras, plants, mirrors, pyramids)
   - Slope and level considerations

7. **Priority Actions**: List 3-5 most important changes in order of priority

Please be specific and practical in your recommendations."""
        
        # Initialize LLM chat with vision model
        chat = LlmChat(
            api_key=api_key,
            session_id=f"{geomancy_type}_{user_id}_{uuid.uuid4()}",
            system_message=system_message
        ).with_model("gemini", "gemini-2.0-flash")
        
        # Create message with image
        user_message = UserMessage(
            text=analysis_prompt,
            file_contents=[ImageContent(image_base64=vastu_data.floor_plan_image)]
        )
        
        # Get AI response
        analysis_response = await chat.send_message(user_message)
        
        # Try to extract compliance score from response
        compliance_score = None
        if "score" in analysis_response.lower() or "/100" in analysis_response:
            # Simple extraction of score (can be enhanced)
            import re
            score_match = re.search(r'(\d+)/100|score.*?(\d+)', analysis_response.lower())
            if score_match:
                compliance_score = int(score_match.group(1) or score_match.group(2))
        
        # Create Vastu analysis record
        vastu_obj = VastuAnalysis(
            property_id=property_id,
            floor_plan_image=vastu_data.floor_plan_image,
            analysis_text=analysis_response,
            compliance_score=compliance_score,
            recommendations=analysis_response,
            geomancy_type=geomancy_type  # Store which type of analysis was performed
        )
        
        await db.vastu_analysis.insert_one(vastu_obj.dict())
        return vastu_obj
        
    except Exception as e:
        logger.error(f"Error analyzing {geomancy_type}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing {geomancy_type}: {str(e)}")

@api_router.get("/properties/{property_id}/vastu", response_model=List[VastuAnalysis])
async def get_vastu_analyses(
    property_id: str, 
    geomancy_type: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Build query
    query = {"property_id": property_id}
    
    # Filter by geomancy type if provided
    if geomancy_type:
        query["geomancy_type"] = geomancy_type
    
    # Get analyses
    analyses = await db.vastu_analysis.find(query).to_list(1000)
    
    return [VastuAnalysis(**a) for a in analyses]

@api_router.delete("/properties/{property_id}/vastu/{vastu_id}")
async def delete_vastu_analysis(
    property_id: str,
    vastu_id: str,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    result = await db.vastu_analysis.delete_one({"id": vastu_id, "property_id": property_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vastu analysis not found")
    
    return {"message": "Vastu analysis deleted successfully"}

# ============= ROOT ENDPOINTS =============

# Receipt/Invoice Analysis Endpoint
@api_router.post("/analyze-receipt")
async def analyze_receipt(request: dict, user_id: str = Depends(get_current_user)):
    await require_ai_consent(user_id)
    try:
        from emergentintegrations import openai_client
        import base64
        import os
        
        image_base64 = request.get("image")
        if not image_base64:
            raise HTTPException(status_code=400, detail="No image provided")
        
        # Use OpenAI Vision to analyze the receipt
        api_key = os.getenv("EMERGENT_LLM_KEY")
        client = openai_client.get_openai_client(api_key=api_key)
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """Analyze this receipt/invoice and extract the following information in JSON format:
                            {
                                "name": "product/appliance name",
                                "make": "brand/manufacturer",
                                "model": "model number",
                                "serial_number": "serial number if visible",
                                "vendor_name": "vendor/store name",
                                "vendor_contact": "vendor phone number",
                                "vendor_email": "vendor email",
                                "warranty_info": "warranty details",
                                "warranty_expiry_date": "warranty expiry date in YYYY-MM-DD format"
                            }
                            
                            Only include fields that are clearly visible in the receipt. Use null for missing fields.
                            Be accurate and extract exactly what you see."""
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=500
        )
        
        # Parse the response
        import json
        content = response.choices[0].message.content
        
        # Try to extract JSON from the response
        try:
            # Sometimes the model wraps JSON in markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            extracted_data = json.loads(content)
        except:
            # If JSON parsing fails, return empty data
            extracted_data = {}
        
        return extracted_data
        
    except Exception as e:
        logger.error(f"Error analyzing receipt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze receipt: {str(e)}")



@api_router.get("/")
async def root():
    return {"message": "Property Manager API"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include the router in the main app

# Health Score Endpoint
@api_router.get("/properties/{property_id}/health-score")
async def get_property_health_score(property_id: str, user_id: str = Depends(get_current_user)):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Initialize score components
    scores = {
        "documents": 0,
        "fixtures": 0,
        "measurements": 0,
        "vastu": 0,
        "overall": 0
    }
    
    recommendations = []
    
    # 1. Document Score (25% weight) - Based on having at least 5 key documents
    documents = await db.documents.find({"property_id": property_id}).to_list(1000)
    doc_count = len(documents)
    expected_docs = 5  # Ownership, insurance, warranties, maintenance records, etc.
    scores["documents"] = min(100, (doc_count / expected_docs) * 100)
    
    if doc_count < expected_docs:
        recommendations.append({
            "category": "documents",
            "message": f"Add {expected_docs - doc_count} more document(s) to reach optimal level",
            "priority": "medium" if doc_count >= 2 else "high"
        })
    
    # 2. Fixtures Score (30% weight) - Based on warranty status
    fixtures = await db.fixtures.find({"property_id": property_id}).to_list(1000)
    fixture_count = len(fixtures)
    
    if fixture_count > 0:
        fixtures_with_warranty = 0
        fixtures_under_warranty = 0
        fixtures_expired = 0
        today = datetime.utcnow()
        
        for fixture in fixtures:
            if fixture.get("warranty_info") or fixture.get("warranty_expiry_date"):
                fixtures_with_warranty += 1
                
                # Check if warranty is still valid
                if fixture.get("warranty_expiry_date"):
                    try:
                        # Try multiple date formats
                        expiry_str = fixture["warranty_expiry_date"]
                        try:
                            expiry_date = datetime.fromisoformat(expiry_str)
                        except:
                            try:
                                from datetime import datetime as dt
                                expiry_date = dt.strptime(expiry_str, "%m/%d/%Y")
                            except:
                                try:
                                    expiry_date = dt.strptime(expiry_str, "%Y-%m-%d")
                                except:
                                    continue
                        
                        if expiry_date >= today:
                            fixtures_under_warranty += 1
                        else:
                            fixtures_expired += 1
                    except:
                        pass
        
        # Score: 50% for having warranty info, 50% for active warranties
        warranty_info_score = (fixtures_with_warranty / fixture_count) * 50
        active_warranty_score = (fixtures_under_warranty / fixture_count) * 50 if fixture_count > 0 else 0
        scores["fixtures"] = warranty_info_score + active_warranty_score
        
        if fixtures_with_warranty < fixture_count:
            recommendations.append({
                "category": "fixtures",
                "message": f"Add warranty information for {fixture_count - fixtures_with_warranty} fixture(s)",
                "priority": "high"
            })
        
        if fixtures_expired > 0:
            recommendations.append({
                "category": "fixtures",
                "message": f"{fixtures_expired} fixture(s) have expired warranties - consider renewal",
                "priority": "medium"
            })
    else:
        scores["fixtures"] = 0
        recommendations.append({
            "category": "fixtures",
            "message": "Add fixtures/appliances to track their maintenance and warranties",
            "priority": "high"
        })
    
    # 3. Measurements Score (25% weight) - Based on room coverage
    measurements = await db.measurements.find({"property_id": property_id}).to_list(1000)
    expected_rooms = 5  # Master bedroom, living, kitchen, bathroom, dining
    
    if measurements and len(measurements) > 0:
        # Count unique room types
        unique_rooms = set()
        for measurement in measurements:
            room_type = measurement.get("room_type")
            if room_type:
                unique_rooms.add(room_type)
        
        measured_rooms = len(unique_rooms)
        scores["measurements"] = min(100, (measured_rooms / expected_rooms) * 100)
        
        if measured_rooms < expected_rooms:
            recommendations.append({
                "category": "measurements",
                "message": f"Add measurements for {expected_rooms - measured_rooms} more room type(s)",
                "priority": "medium"
            })
    else:
        scores["measurements"] = 0
        recommendations.append({
            "category": "measurements",
            "message": "Add property measurements for all rooms",
            "priority": "high"
        })
    
    # 4. Vastu Score (20% weight) - Based on vastu analysis
    vastu_results = await db.vastu_analysis.find({"property_id": property_id}).to_list(1000)
    
    if vastu_results and len(vastu_results) > 0:
        # If vastu analysis exists, give full score
        scores["vastu"] = 100
    else:
        scores["vastu"] = 0
        recommendations.append({
            "category": "vastu",
            "message": "Upload floor plan for Vastu analysis",
            "priority": "low"
        })
    
    # Calculate overall weighted score
    weights = {
        "documents": 0.25,
        "fixtures": 0.30,
        "measurements": 0.25,
        "vastu": 0.20
    }
    
    scores["overall"] = (
        scores["documents"] * weights["documents"] +
        scores["fixtures"] * weights["fixtures"] +
        scores["measurements"] * weights["measurements"] +
        scores["vastu"] * weights["vastu"]
    )
    
    # Determine grade
    if scores["overall"] >= 90:
        grade = "A"
        grade_color = "#34C759"  # Green
    elif scores["overall"] >= 80:
        grade = "B"
        grade_color = "#5856D6"  # Purple
    elif scores["overall"] >= 70:
        grade = "C"
        grade_color = "#FF9500"  # Orange
    elif scores["overall"] >= 60:
        grade = "D"
        grade_color = "#FF9500"  # Orange
    else:
        grade = "F"
        grade_color = "#FF3B30"  # Red
    
    # Sort recommendations by priority
    priority_order = {"high": 1, "medium": 2, "low": 3}
    recommendations.sort(key=lambda x: priority_order[x["priority"]])
    
    return {
        "property_id": property_id,
        "score": round(scores["overall"], 1),
        "grade": grade,
        "grade_color": grade_color,
        "breakdown": {
            "documents": {
                "score": round(scores["documents"], 1),
                "weight": weights["documents"] * 100,
                "count": doc_count,
                "expected": expected_docs
            },
            "fixtures": {
                "score": round(scores["fixtures"], 1),
                "weight": weights["fixtures"] * 100,
                "count": fixture_count
            },
            "measurements": {
                "score": round(scores["measurements"], 1),
                "weight": weights["measurements"] * 100,
                "measured_rooms": measured_rooms if measurements else 0,
                "expected_rooms": expected_rooms
            },
            "vastu": {
                "score": round(scores["vastu"], 1),
                "weight": weights["vastu"] * 100,
                "analyzed": len(vastu_results) > 0
            }
        },
        "recommendations": recommendations
    }


# ============= ASSET IDENTIFICATION ENDPOINT =============

@api_router.post("/scan-asset")
async def scan_asset(request: ImageScanRequest, user_id: str = Depends(get_current_user)):
    """
    Identify what type of asset is in an image using Gemini AI
    """
    await require_ai_consent(user_id)
    import json
    import base64
    
    try:
        
        # Get API key
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        # Clean base64 string - remove any data URL prefix if present
        image_data = request.image
        if image_data.startswith('data:'):
            # Remove data:image/...;base64, prefix
            image_data = image_data.split(',', 1)[1] if ',' in image_data else image_data
        
        # Validate base64
        try:
            base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"Invalid base64 image: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image data")
        
        logger.info(f"Processing asset scan with image data length: {len(image_data)}")
        
        # Use Gemini to identify the asset type
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        # Create the chat instance
        chat = LlmChat(
            api_key=api_key,
            session_id=f"asset_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert at identifying physical assets and objects."
        ).with_model("gemini", "gemini-2.0-flash")
        
        # Create the user message with prompt and image
        user_message = UserMessage(
            text="""Look at this image and identify what type of asset it is.

Respond with ONLY a JSON object in this exact format:
{
    "asset_type": "<one of: vehicle, appliance, jewelry, furniture, art>",
    "confidence": <number between 0 and 1>,
    "description": "<brief description of what you see>"
}

Rules:
- vehicle: cars, motorcycles, boats, RVs, etc.
- appliance: TV, refrigerator, washing machine, microwave, AC, etc.
- jewelry: rings, necklaces, watches, bracelets, etc.
- furniture: sofas, chairs, tables, beds, cabinets, etc.
- art: paintings, sculptures, drawings, antiques, collectibles, etc.

Choose the MOST appropriate category. Return ONLY the JSON, no other text.""",
            file_contents=[ImageContent(image_base64=image_data)]
        )
        
        # Get AI response
        response = await chat.send_message(user_message)
        
        # Parse the JSON response
        # Try to extract JSON from response
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        if json_start != -1 and json_end > json_start:
            json_str = response[json_start:json_end]
            result = json.loads(json_str)
        else:
            result = json.loads(response)
        
        # Validate and return
        return {
            "asset_type": result.get("asset_type", "appliance"),
            "confidence": result.get("confidence", 0.5),
            "description": result.get("description", "Asset identified")
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        # Return a default response
        return {
            "asset_type": "appliance",
            "confidence": 0.3,
            "description": "Could not clearly identify the asset type"
        }
    except Exception as e:
        logger.error(f"Asset identification error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to identify asset: {str(e)}")


# ============= MAINTENANCE TRACKING ENDPOINTS =============

@api_router.post("/maintenance", response_model=MaintenanceRecord)
async def create_maintenance(maintenance_data: MaintenanceCreate, user_id: str = Depends(get_current_user)):
    """Create a new maintenance record"""
    maintenance = MaintenanceRecord(user_id=user_id, **maintenance_data.dict())
    await db.maintenance.insert_one(maintenance.dict())
    return maintenance

@api_router.get("/maintenance")
async def get_all_maintenance(
    user_id: str = Depends(get_current_user),
    asset_type: Optional[str] = None,
    asset_id: Optional[str] = None,
    completed: Optional[bool] = None,
    upcoming_days: Optional[int] = None
):
    """Get maintenance records with optional filters"""
    query = {"user_id": user_id}
    
    if asset_type:
        query["asset_type"] = asset_type
    if asset_id:
        query["asset_id"] = asset_id
    if completed is not None:
        query["completed"] = completed
    
    maintenance_list = await db.maintenance.find(query).sort("due_date", 1).to_list(length=1000)
    
    # Filter by upcoming days if specified
    if upcoming_days is not None:
        cutoff_date = datetime.utcnow() + timedelta(days=upcoming_days)
        maintenance_list = [
            m for m in maintenance_list 
            if not m.get('completed') and m.get('due_date') <= cutoff_date
        ]
    
    # Convert ObjectId to string
    for m in maintenance_list:
        if '_id' in m:
            m['_id'] = str(m['_id'])
    
    return maintenance_list

@api_router.get("/maintenance/upcoming")
async def get_upcoming_maintenance(user_id: str = Depends(get_current_user), days: int = 30):
    """Get upcoming maintenance within specified days"""
    cutoff_date = datetime.utcnow() + timedelta(days=days)
    
    maintenance_list = await db.maintenance.find({
        "user_id": user_id,
        "completed": False,
        "due_date": {"$lte": cutoff_date}
    }).sort("due_date", 1).to_list(length=1000)
    
    for m in maintenance_list:
        if '_id' in m:
            m['_id'] = str(m['_id'])
    
    return maintenance_list

@api_router.get("/maintenance/overdue")
async def get_overdue_maintenance(user_id: str = Depends(get_current_user)):
    """Get overdue maintenance records"""
    maintenance_list = await db.maintenance.find({
        "user_id": user_id,
        "completed": False,
        "due_date": {"$lt": datetime.utcnow()}
    }).sort("due_date", 1).to_list(length=1000)
    
    for m in maintenance_list:
        if '_id' in m:
            m['_id'] = str(m['_id'])
    
    return maintenance_list

@api_router.get("/maintenance/asset/{asset_type}/{asset_id}")
async def get_maintenance_for_asset(
    asset_type: str,
    asset_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get all maintenance records for a specific asset"""
    maintenance_list = await db.maintenance.find({
        "user_id": user_id,
        "asset_type": asset_type,
        "asset_id": asset_id
    }).sort("due_date", -1).to_list(length=1000)
    
    for m in maintenance_list:
        if '_id' in m:
            m['_id'] = str(m['_id'])
    
    return maintenance_list

@api_router.get("/maintenance/{maintenance_id}")
async def get_maintenance_by_id(maintenance_id: str, user_id: str = Depends(get_current_user)):
    """Get a specific maintenance record"""
    maintenance = await db.maintenance.find_one({"id": maintenance_id, "user_id": user_id})
    if not maintenance:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    
    if '_id' in maintenance:
        maintenance['_id'] = str(maintenance['_id'])
    return maintenance

@api_router.put("/maintenance/{maintenance_id}")
async def update_maintenance(
    maintenance_id: str,
    maintenance_data: MaintenanceUpdate,
    user_id: str = Depends(get_current_user)
):
    """Update a maintenance record"""
    update_data = {k: v for k, v in maintenance_data.dict().items() if v is not None}
    
    result = await db.maintenance.update_one(
        {"id": maintenance_id, "user_id": user_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    
    # If completed and recurring, create next occurrence
    if update_data.get('completed') and update_data.get('completed_date'):
        maintenance = await db.maintenance.find_one({"id": maintenance_id, "user_id": user_id})
        if maintenance and maintenance.get('recurring') and maintenance.get('recurring_interval_days'):
            next_due_date = maintenance['due_date'] + timedelta(days=maintenance['recurring_interval_days'])
            next_maintenance = MaintenanceRecord(
                user_id=user_id,
                asset_type=maintenance['asset_type'],
                asset_id=maintenance['asset_id'],
                asset_name=maintenance['asset_name'],
                maintenance_type=maintenance['maintenance_type'],
                description=maintenance['description'],
                due_date=next_due_date,
                cost=maintenance.get('cost'),
                notes=maintenance.get('notes'),
                recurring=True,
                recurring_interval_days=maintenance['recurring_interval_days']
            )
            await db.maintenance.insert_one(next_maintenance.dict())
    
    return {"message": "Maintenance updated successfully"}

@api_router.delete("/maintenance/{maintenance_id}")
async def delete_maintenance(maintenance_id: str, user_id: str = Depends(get_current_user)):
    """Delete a maintenance record"""
    result = await db.maintenance.delete_one({"id": maintenance_id, "user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    
    return {"message": "Maintenance deleted successfully"}


# ============= PROPERTY MANAGEMENT & MEMBERSHIP ENDPOINTS =============

# Removed duplicate add_property_member endpoint - using the admin-only version below

# Removed duplicate endpoint - using the admin-only version below

@api_router.get("/users/properties")
async def get_user_properties(user_id: str = Depends(get_current_user)):
    owned = await db.properties.find({"user_id": user_id}).to_list(length=1000)
    memberships = await db.property_memberships.find({"user_id": user_id,
        "status": {"$in": ACTIVE_MEMBERSHIP_STATES}}).to_list(length=1000)
    assignments = await db.property_admin_assignments.find({"admin_user_id": user_id}).to_list(length=1000)
    result = {p["id"]: {**p, "user_role": "owner"} for p in owned}
    for row in memberships + assignments:
        property_id = row["property_id"]
        prop = await db.community_properties.find_one({"id": property_id, "is_active": True})
        if not prop:
            prop = await db.properties.find_one({"id": property_id})
        if prop:
            result[property_id] = {**prop, "user_role": "admin" if "admin_user_id" in row else row.get("role", "resident")}
    for prop in result.values():
        prop.pop("_id", None)
    return list(result.values())

async def find_joinable_property(property_id):
    prop = await db.community_properties.find_one({"id": property_id, "is_active": True})
    if not prop:
        raise HTTPException(status_code=404, detail="Active community not found")
    return prop

async def submit_membership_request(property_id, user_id, role, documents, document_names):
    prop = await find_joinable_property(property_id)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="Account is unavailable")
    membership = await db.property_memberships.find_one({"property_id": property_id, "user_id": user_id,
        "status": {"$in": ACTIVE_MEMBERSHIP_STATES}})
    if membership:
        raise HTTPException(status_code=409, detail="Already a community member")
    data = {"id": str(uuid.uuid4()), "user_id": user_id, "username": user["username"],
        "email": user.get("email") or "", "property_id": property_id, "property_name": prop["name"],
        "requested_role": role, "documents": documents, "document_names": document_names,
        "status": "pending", "created_at": datetime.utcnow()}
    # A repeated onboarding submission updates the same pending request.
    await db.pending_user_approvals.update_one({"user_id": user_id, "property_id": property_id},
        {"$set": {k: v for k, v in data.items() if k != "id"}, "$setOnInsert": {"id": data["id"]}}, upsert=True)
    await db.property_memberships.update_one({"user_id": user_id, "property_id": property_id},
        {"$set": {"status": "pending", "role": role}, "$setOnInsert": {
            "id": str(uuid.uuid4()), "user_id": user_id, "property_id": property_id, "joined_at": datetime.utcnow()}}, upsert=True)
    return {"message": "Community membership submitted for approval", "status": "pending"}

# ============= PROPERTY MEMBERSHIP ENDPOINTS =============

@api_router.get("/test-public")
async def test_public_endpoint():
    """Test public endpoint - No authentication required"""
    return {"message": "This is a public endpoint", "status": "success"}

@api_router.get("/public/properties")
async def get_all_properties():
    """Get all community properties (for registration property selection) - No authentication required"""
    # Get only active community properties added by super admins
    properties = await db.community_properties.find({"is_active": True}).to_list(length=1000)
    result = []
    for prop in properties:
        if '_id' in prop:
            prop['_id'] = str(prop['_id'])
        result.append({
            "id": prop["id"],
            "name": prop["name"],
            "address": prop["address"],
            "logo": prop.get("logo")
        })
    return result

@api_router.get("/properties/{property_id}/members")
async def get_property_members(property_id: str, user_id: str = Depends(get_current_user)):
    await require_community(db, property_id, user_id, {"admin"})
    memberships = await db.property_memberships.find({"property_id": property_id}).to_list(length=1000)
    result = []
    for membership in memberships:
        user = await db.users.find_one({"id": membership["user_id"]})
        if user:
            result.append({"membership_id": membership["id"], "user_id": user["id"],
                "username": user["username"], "email": user.get("email"), "phone": user.get("phone"),
                "role": membership.get("role", "resident"), "unit_number": membership.get("unit_number"),
                "status": membership.get("status", "pending"), "joined_at": membership.get("joined_at")})
    return result

@api_router.post("/properties/{property_id}/members")
async def add_property_member(
    property_id: str,
    membership: PropertyMembershipCreate,
    user_id: str = Depends(get_current_user)
):
    """Add a user to a property (admin only)"""
    # Check if user is admin of this property
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is super admin
    is_super_admin = user_doc.get("is_super_admin", False)
    
    # Check if user manages this specific property
    admin_assignment = await db.property_admin_assignments.find_one({
        "admin_user_id": user_id,
        "property_id": property_id
    })
    
    # Only allow access if user is super admin OR manages this specific property
    if not is_super_admin and not admin_assignment:
        raise HTTPException(status_code=403, detail="Not authorized to add members")
    
    # Verify property exists (check both regular properties and community properties)
    property_doc = await db.properties.find_one({"id": property_id})
    if not property_doc:
        # Check if it's a community property
        community_property_doc = await db.community_properties.find_one({"id": property_id})
        if not community_property_doc:
            raise HTTPException(status_code=404, detail="Property not found")
    
    # Verify target user exists
    target_user = await db.users.find_one({"id": membership.user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    # Check if membership already exists
    existing = await db.property_memberships.find_one({
        "user_id": membership.user_id,
        "property_id": property_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this property")
    
    # Create membership
    new_membership = {
        "id": str(uuid.uuid4()),
        "user_id": membership.user_id,
        "property_id": property_id,
        "status": "active" if membership.status == "approved" else membership.status,
        "role": membership.role,
        "unit_number": membership.unit_number,
        "joined_at": datetime.utcnow(),
        "approved_by": user_id,
        "approved_at": datetime.utcnow(),
        "documents": []
    }
    
    await db.property_memberships.insert_one(new_membership)
    
    # Add to user's member_properties
    await db.users.update_one(
        {"id": membership.user_id},
        {"$addToSet": {"member_properties": property_id}}
    )
    
    return {"message": "Member added successfully", "membership_id": new_membership["id"]}

@api_router.delete("/properties/{property_id}/members/{member_user_id}")
async def remove_property_member(
    property_id: str,
    member_user_id: str,
    user_id: str = Depends(get_current_user)
):
    """Remove a user from a property (admin only)"""
    # Check if user is admin of this property
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is super admin
    is_super_admin = user_doc.get("is_super_admin", False)
    
    # Check if user manages this specific property
    admin_assignment = await db.property_admin_assignments.find_one({
        "admin_user_id": user_id,
        "property_id": property_id
    })
    
    # Only allow access if user is super admin OR manages this specific property
    if not is_super_admin and not admin_assignment:
        raise HTTPException(status_code=403, detail="Not authorized to remove members")
    
    # Delete membership
    result = await db.property_memberships.delete_one({
        "user_id": member_user_id,
        "property_id": property_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    # Remove from user's member_properties
    await db.users.update_one(
        {"id": member_user_id},
        {"$pull": {"member_properties": property_id}}
    )
    
    return {"message": "Member removed successfully"}

@api_router.post("/properties/{property_id}/join")
async def join_property(property_id: str, unit_number: Optional[str] = None, user_id: str = Depends(get_current_user)):
    result = await submit_membership_request(property_id, user_id, "resident", [], [])
    if unit_number:
        await db.property_memberships.update_one({"property_id": property_id, "user_id": user_id}, {"$set": {"unit_number": unit_number}})
    return result

# ============= HOA CHARGES & PAYMENT ENDPOINTS =============

@api_router.post("/properties/{property_id}/hoa-charges", response_model=HOACharge)
async def create_hoa_charge(
    property_id: str,
    charge_data: HOAChargeCreate,
    user_id: str = Depends(get_current_user)
):
    """Create HOA maintenance charge (admin/owner only)"""
    await require_community(db, property_id, user_id, {"admin"})
    charge = HOACharge(
        created_by=user_id,
        **scoped_data(charge_data, "property_id", property_id)
    )
    await db.hoa_charges.insert_one(charge.dict())
    return charge

@api_router.get("/properties/{property_id}/hoa-charges")
async def get_hoa_charges(
    property_id: str,
    user_id: str = Depends(get_current_user),
    status: Optional[str] = None
):
    """Get HOA charges for a property"""
    await require_community(db, property_id, user_id)
    
    query = {"property_id": property_id}
    if status:
        query["status"] = status
    
    charges = await db.hoa_charges.find(query).sort("due_date", -1).to_list(length=1000)
    
    for c in charges:
        if '_id' in c:
            c['_id'] = str(c['_id'])
    
    return charges

# Stripe payment integration
@api_router.post("/payments/hoa/create-checkout")
async def create_hoa_payment_checkout(
    payload: HOACheckoutRequest,
    user_id: str = Depends(get_current_user)
):
    """Create Stripe checkout session for HOA charge payment"""
    charge_id = payload.charge_id
    origin_url = os.environ.get("PAYMENT_RETURN_ORIGIN", "https://aurainfra.ai").rstrip("/")
    if payload.origin_url and payload.origin_url.rstrip("/") != origin_url:
        raise HTTPException(status_code=400, detail="Invalid payment return origin")
    # Get charge details
    charge = await db.hoa_charges.find_one({"id": charge_id})
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")
    
    if charge['status'] == 'paid':
        raise HTTPException(status_code=400, detail="Charge already paid")
    
    property_id = charge["property_id"]
    await require_community(db, property_id, user_id)
    
    if origin_url.rstrip("/") != os.environ.get("PAYMENT_RETURN_ORIGIN", "https://aurainfra.ai").rstrip("/"):
        raise HTTPException(status_code=400, detail="Invalid payment return origin")
    if charge.get("user_id") and charge["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="This charge belongs to another resident")
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    # Initialize Stripe
    stripe_api_key = os.environ.get('STRIPE_API_KEY')
    webhook_origin = os.environ.get("BACKEND_PUBLIC_URL", origin_url).rstrip("/")
    webhook_url = f"{webhook_origin}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    # Build success and cancel URLs
    success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/properties"
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=float(charge['amount']),  # Stripe requires float
        currency=charge['currency'].lower(),
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "charge_id": charge_id,
            "user_id": user_id,
            "property_id": property_id,
            "type": "hoa_charge"
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    transaction = PaymentTransaction(
        user_id=user_id,
        charge_id=charge_id,
        property_id=property_id,
        amount=charge['amount'],
        currency=charge['currency'],
        stripe_session_id=session.session_id,
        payment_status="pending",
        metadata=checkout_request.metadata
    )
    await db.payment_transactions.insert_one(transaction.dict())
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/payments/checkout/status/{session_id}")
async def get_payment_status(
    session_id: str,
    user_id: str = Depends(get_current_user)
):
    """Check payment status and update records"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    # Get transaction
    transaction = await db.payment_transactions.find_one({"stripe_session_id": session_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Verify user owns this transaction
    if transaction['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # If already marked as paid, return success
    if transaction['payment_status'] == 'paid':
        return {
            "status": "complete",
            "payment_status": "paid",
            "amount_total": int(transaction['amount'] * 100),  # Convert to cents
            "currency": transaction['currency']
        }
    
    # Check with Stripe
    stripe_api_key = os.environ.get('STRIPE_API_KEY')
    webhook_url = ""  # Not needed for status check
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    status_response = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction if payment completed
    if status_response.payment_status == 'paid' and transaction['payment_status'] != 'paid':
        # Update transaction
        await db.payment_transactions.update_one(
            {"stripe_session_id": session_id},
            {
                "$set": {
                    "payment_status": "paid",
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Update HOA charge
        await db.hoa_charges.update_one(
            {"id": transaction['charge_id']},
            {
                "$set": {
                    "status": "paid",
                    "paid_date": datetime.utcnow(),
                    "stripe_session_id": session_id
                }
            }
        )
    
    return status_response.dict()

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    stripe_api_key = os.environ.get('STRIPE_API_KEY')
    webhook_url = ""
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Handle payment success
        if webhook_response.payment_status == 'paid':
            session_id = webhook_response.session_id
            
            # Find transaction
            transaction = await db.payment_transactions.find_one({"stripe_session_id": session_id})
            if transaction and transaction['payment_status'] != 'paid':
                # Update transaction
                await db.payment_transactions.update_one(
                    {"stripe_session_id": session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.utcnow()}}
                )
                
                # Update HOA charge
                await db.hoa_charges.update_one(
                    {"id": transaction['charge_id']},
                    {"$set": {"status": "paid", "paid_date": datetime.utcnow()}}
                )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# ============= VISITOR MANAGEMENT ENDPOINTS =============

@api_router.post("/properties/{property_id}/visitors", response_model=Visitor)
async def create_visitor(
    property_id: str,
    visitor_data: VisitorCreate,
    user_id: str = Depends(get_current_user)
):
    """Create/register a visitor"""
    await require_community(db, property_id, user_id)
    
    # Generate approval code
    approval_code = str(uuid.uuid4())[:8].upper()
    
    visitor = Visitor(
        host_user_id=user_id,
        approval_code=approval_code,
        **scoped_data(visitor_data, "property_id", property_id)
    )
    await db.visitors.insert_one(visitor.dict())
    return visitor

@api_router.get("/properties/{property_id}/visitors")
async def get_property_visitors(
    property_id: str,
    user_id: str = Depends(get_current_user),
    status: Optional[str] = None,
    date_filter: Optional[str] = None  # "today", "upcoming", "past"
):
    """Get visitors for a property"""
    role = await require_community(db, property_id, user_id)
    query = {"property_id": property_id}
    if role == "resident":
        query["host_user_id"] = user_id
    if status:
        query["status"] = status
    if date_filter == "today":
        today = datetime.utcnow().date()
        query["expected_date"] = {
            "$gte": datetime.combine(today, datetime.min.time()),
            "$lt": datetime.combine(today, datetime.max.time())
        }
    elif date_filter == "upcoming":
        query["expected_date"] = {"$gte": datetime.utcnow()}
    elif date_filter == "past":
        query["expected_date"] = {"$lt": datetime.utcnow()}
    
    visitors = await db.visitors.find(query).sort("expected_date", -1).to_list(length=1000)
    
    for v in visitors:
        if '_id' in v:
            v['_id'] = str(v['_id'])
    
    return visitors

@api_router.put("/visitors/{visitor_id}/approve")
async def approve_visitor(
    visitor_id: str,
    approval_data: VisitorApproval,
    user_id: str = Depends(get_current_user)
):
    """Approve or reject visitor (security/admin)"""
    visitor = await db.visitors.find_one({"id": visitor_id})
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    await require_community(db, visitor["property_id"], user_id, {"admin", "security"})
    
    
    update_data = {
        "status": approval_data.status,
        "approved_by": user_id,
        "approved_at": datetime.utcnow()
    }
    
    if approval_data.notes:
        update_data["notes"] = approval_data.notes
    
    await db.visitors.update_one(
        {"id": visitor_id},
        {"$set": update_data}
    )
    
    return {"message": f"Visitor {approval_data.status}"}

@api_router.post("/visitors/{visitor_id}/check-in")
async def check_in_visitor(
    visitor_id: str,
    check_in_data: VisitorCheckIn,
    user_id: str = Depends(get_current_user)
):
    """Check in a visitor"""
    visitor = await db.visitors.find_one({"id": visitor_id})
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    await require_community(db, visitor["property_id"], user_id, {"admin", "security"})
    
    if visitor['status'] != 'approved':
        raise HTTPException(status_code=400, detail="Visitor not approved")
    
    await db.visitors.update_one(
        {"id": visitor_id},
        {
            "$set": {
                "status": "checked_in",
                "check_in_time": check_in_data.check_in_time
            }
        }
    )
    
    return {"message": "Visitor checked in"}

@api_router.post("/visitors/{visitor_id}/check-out")
async def check_out_visitor(
    visitor_id: str,
    check_out_data: VisitorCheckOut,
    user_id: str = Depends(get_current_user)
):
    """Check out a visitor"""
    visitor = await db.visitors.find_one({"id": visitor_id})
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    await require_community(db, visitor["property_id"], user_id, {"admin", "security"})
    
    if visitor['status'] != 'checked_in':
        raise HTTPException(status_code=400, detail="Visitor not checked in")
    
    await db.visitors.update_one(
        {"id": visitor_id},
        {
            "$set": {
                "status": "checked_out",
                "check_out_time": check_out_data.check_out_time
            }
        }
    )
    
    return {"message": "Visitor checked out"}

# ============= COMMUNITY BOARD ENDPOINTS =============

@api_router.post("/properties/{property_id}/community/posts", response_model=CommunityPost)
async def create_community_post(property_id: str, post_data: CommunityPostCreate, user_id: str = Depends(get_current_user)):
    role = await require_community(db, property_id, user_id)
    await require_content_terms(db, user_id)
    validate_content(post_data.title, post_data.content)
    if sum(len(photo) for photo in (post_data.photos or [])) > 14_000_000:
        raise HTTPException(status_code=413, detail="Photos are too large")
    user = await db.users.find_one({"id": user_id})
    post = CommunityPost(user_id=user_id, user_name=user["username"], user_role=role,
        is_admin_post=role == "admin", **scoped_data(post_data, "property_id", property_id))
    await db.community_posts.insert_one(post.dict())
    return post

@api_router.get("/properties/{property_id}/community/posts")
async def get_community_posts(
    property_id: str,
    user_id: str = Depends(get_current_user),
    category: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get community posts for a property"""
    await require_community(db, property_id, user_id)
    
    if not 1 <= limit <= 100 or skip < 0:
        raise HTTPException(status_code=400, detail="Invalid pagination")
    query = {"property_id": property_id, "moderation_status": "approved",
        "user_id": {"$nin": await blocked_users(db, user_id)}}
    if category:
        query["category"] = category
    
    # Sort by pinned first, then by created_at
    posts = await db.community_posts.find(query).sort([
        ("is_pinned", -1),
        ("created_at", -1)
    ]).skip(skip).limit(limit).to_list(length=limit)
    
    for p in posts:
        if '_id' in p:
            p['_id'] = str(p['_id'])
    
    return posts

@api_router.get("/community/posts/{post_id}")
async def get_post(post_id: str, user_id: str = Depends(get_current_user)):
    post = await visible_post(db, post_id, user_id)
    post.pop("_id", None)
    return post

@api_router.put("/community/posts/{post_id}")
async def update_post(post_id: str, post_data: CommunityPostUpdate, user_id: str = Depends(get_current_user)):
    post = await db.community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    role = await require_community(db, post["property_id"], user_id)
    if post["user_id"] != user_id and role != "admin":
        raise HTTPException(status_code=403, detail="Only the author or community administrator may edit")
    changes = post_data.dict(exclude_none=True)
    if "is_pinned" in changes and role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can pin posts")
    if any(field in changes for field in ("title", "content", "photos")):
        validate_content(changes.get("title", post["title"]), changes.get("content", post["content"]))
        changes["moderation_status"] = "pending"
    changes["updated_at"] = datetime.utcnow()
    await db.community_posts.update_one({"id": post_id}, {"$set": changes})
    return {"message": "Post updated; changed content requires review"}
    
@api_router.delete("/community/posts/{post_id}")
async def delete_post(post_id: str, user_id: str = Depends(get_current_user)):
    post = await db.community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    role = await require_community(db, post["property_id"], user_id)
    if post["user_id"] != user_id and role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    await db.community_comments.delete_many({"post_id": post_id})
    await db.post_likes.delete_many({"post_id": post_id})
    await db.community_posts.delete_one({"id": post_id})
    return {"message": "Post deleted"}

@api_router.post("/community/posts/{post_id}/comments", response_model=CommunityComment)
async def create_comment(post_id: str, comment_data: CommunityCommentCreate, user_id: str = Depends(get_current_user)):
    await visible_post(db, post_id, user_id)
    await require_content_terms(db, user_id)
    validate_content(comment_data.content)
    user = await db.users.find_one({"id": user_id})
    comment = CommunityComment(user_id=user_id, user_name=user["username"], **scoped_data(comment_data, "post_id", post_id))
    await db.community_comments.insert_one(comment.dict())
    return comment

@api_router.get("/community/posts/{post_id}/comments")
async def get_comments(post_id: str, user_id: str = Depends(get_current_user)):
    await visible_post(db, post_id, user_id)
    comments = await db.community_comments.find({"post_id": post_id, "moderation_status": "approved",
        "user_id": {"$nin": await blocked_users(db, user_id)}}).sort("created_at", 1).to_list(length=1000)
    for comment in comments:
        comment.pop("_id", None)
    return comments

@api_router.post("/community/posts/{post_id}/like")
async def toggle_post_like(post_id: str, user_id: str = Depends(get_current_user)):
    """Like or unlike a post"""
    await visible_post(db, post_id, user_id)
    # Check if already liked
    existing_like = await db.post_likes.find_one({
        "post_id": post_id,
        "user_id": user_id
    })
    
    if existing_like:
        # Unlike
        await db.post_likes.delete_one({"post_id": post_id, "user_id": user_id})
        await db.community_posts.update_one(
            {"id": post_id},
            {"$inc": {"likes_count": -1}}
        )
        return {"message": "Unliked", "liked": False}
    else:
        # Like
        like = PostLike(post_id=post_id, user_id=user_id)
        await db.post_likes.insert_one(like.dict())
        await db.community_posts.update_one(
            {"id": post_id},
            {"$inc": {"likes_count": 1}}
        )
        return {"message": "Liked", "liked": True}


# ============= AMENITIES BOOKING ENDPOINTS =============

@api_router.post("/properties/{property_id}/amenities", response_model=Amenity)
async def create_amenity(
    property_id: str,
    amenity_data: AmenityCreate,
    user_id: str = Depends(get_current_user)
):
    """Create amenity (admin only)"""
    await require_community(db, property_id, user_id, {"admin"})
    amenity = Amenity(**scoped_data(amenity_data, "property_id", property_id))
    await db.amenities.insert_one(amenity.dict())
    return amenity

@api_router.get("/properties/{property_id}/amenities")
async def get_amenities(property_id: str, user_id: str = Depends(get_current_user)):
    """Get all amenities for a property"""
    await require_community(db, property_id, user_id)
    amenities = await db.amenities.find({"property_id": property_id}).to_list(length=1000)
    for a in amenities:
        if '_id' in a:
            a['_id'] = str(a['_id'])
    return amenities

@api_router.post("/amenities/book", response_model=AmenityBooking)
async def book_amenity(
    booking_data: AmenityBookingCreate,
    user_id: str = Depends(get_current_user)
):
    """Book an amenity"""
    amenity = await db.amenities.find_one({"id": booking_data.amenity_id})
    if not amenity:
        raise HTTPException(status_code=404, detail="Amenity not found")
    await require_community(db, amenity["property_id"], user_id)
    
    user = await db.users.find_one({"id": user_id})
    user_name = user.get('username', 'Unknown') if user else 'Unknown'
    
    booking = AmenityBooking(
        user_id=user_id,
        user_name=user_name,
        property_id=amenity['property_id'],
        **booking_data.dict()
    )
    await db.amenity_bookings.insert_one(booking.dict())
    return booking

@api_router.get("/properties/{property_id}/amenity-bookings")
async def get_amenity_bookings(
    property_id: str,
    user_id: str = Depends(get_current_user),
    status: Optional[str] = None
):
    """Get amenity bookings for a property"""
    await require_community(db, property_id, user_id)
    query = {"property_id": property_id}
    if status:
        query["status"] = status
    
    bookings = await db.amenity_bookings.find(query).sort("booking_date", -1).to_list(length=1000)
    for b in bookings:
        if '_id' in b:
            b['_id'] = str(b['_id'])
    return bookings

@api_router.put("/amenity-bookings/{booking_id}")
async def update_booking(
    booking_id: str,
    booking_data: AmenityBookingUpdate,
    user_id: str = Depends(get_current_user)
):
    """Update booking status (approve/reject)"""
    booking = await db.amenity_bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    role = await require_community(db, booking["property_id"], user_id)
    if role != "admin" and not (booking["user_id"] == user_id and booking_data.status == "cancelled" and booking_data.payment_status is None):
        raise HTTPException(status_code=403, detail="Only administrators can approve bookings or change payment status")
    update_data = {k: v for k, v in booking_data.dict().items() if v is not None}
    
    if 'status' in update_data and update_data['status'] in ['approved', 'rejected']:
        update_data['approved_by'] = user_id
        update_data['approved_at'] = datetime.utcnow()
    
    result = await db.amenity_bookings.update_one(
        {"id": booking_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return {"message": "Booking updated successfully"}

# ============= COMPLAINTS/SERVICE REQUESTS ENDPOINTS =============

@api_router.post("/properties/{property_id}/complaints", response_model=Complaint)
async def create_complaint(
    property_id: str,
    complaint_data: ComplaintCreate,
    user_id: str = Depends(get_current_user)
):
    """Submit a complaint or service request"""
    await require_community(db, property_id, user_id)
    user = await db.users.find_one({"id": user_id})
    user_name = user.get('username', 'Unknown') if user else 'Unknown'
    
    complaint = Complaint(
        user_id=user_id,
        user_name=user_name,
        **scoped_data(complaint_data, "property_id", property_id)
    )
    await db.complaints.insert_one(complaint.dict())
    return complaint

@api_router.get("/properties/{property_id}/complaints")
async def get_complaints(
    property_id: str,
    user_id: str = Depends(get_current_user),
    status: Optional[str] = None,
    category: Optional[str] = None
):
    """Get complaints for a property"""
    await require_community(db, property_id, user_id)
    query = {"property_id": property_id}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    
    complaints = await db.complaints.find(query).sort("created_at", -1).to_list(length=1000)
    for c in complaints:
        if '_id' in c:
            c['_id'] = str(c['_id'])
    return complaints

@api_router.put("/complaints/{complaint_id}")
async def update_complaint(
    complaint_id: str,
    complaint_data: ComplaintUpdate,
    user_id: str = Depends(get_current_user)
):
    """Update complaint status"""
    complaint = await db.complaints.find_one({"id": complaint_id})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    await require_community(db, complaint["property_id"], user_id, {"admin"})
    update_data = {k: v for k, v in complaint_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    if 'status' in update_data and update_data['status'] == 'resolved':
        update_data['resolved_at'] = datetime.utcnow()
    
    result = await db.complaints.update_one(
        {"id": complaint_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    return {"message": "Complaint updated successfully"}

# ============= DOCUMENT REPOSITORY ENDPOINTS =============

@api_router.post("/properties/{property_id}/hoa-documents", response_model=Document)
async def upload_hoa_document(
    property_id: str,
    document_data: DocumentCreate,
    user_id: str = Depends(get_current_user)
):
    """Upload an HOA document (admin only)"""
    # Verify user is HOA admin for this property
    await verify_hoa_admin(property_id, user_id)
    
    if document_data.file_data and len(document_data.file_data) > 14_000_000:
        raise HTTPException(status_code=413, detail="Document is too large")
    doc_dict = scoped_data(document_data, "property_id", property_id)
    doc_dict.pop('property_id', None)
    
    document = Document(
        property_id=property_id,
        uploaded_by=user_id,
        **doc_dict
    )
    await db.documents.insert_one(document.dict())
    return document

@api_router.get("/properties/{property_id}/hoa-documents")
async def get_hoa_documents(
    property_id: str,
    user_id: str = Depends(get_current_user),
    category: Optional[str] = None
):
    """Get HOA documents for a property"""
    await require_community(db, property_id, user_id)
    query = {"property_id": property_id}
    if category:
        query["category"] = category
    
    documents = await db.documents.find(query).sort("upload_date", -1).to_list(length=1000)
    for d in documents:
        if '_id' in d:
            d['_id'] = str(d['_id'])
    return documents

@api_router.get("/properties/{property_id}/hoa-documents/{document_id}")
async def get_hoa_document_by_id(
    property_id: str,
    document_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get a single HOA document with file data"""
    await require_community(db, property_id, user_id)
    document = await db.documents.find_one({"id": document_id, "property_id": property_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if '_id' in document:
        document['_id'] = str(document['_id'])
    
    return document

@api_router.delete("/documents/{document_id}")
async def delete_document_simple(document_id: str, user_id: str = Depends(get_current_user)):
    document = await db.documents.find_one({"id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    await require_community(db, document["property_id"], user_id, {"admin"})
    await db.documents.delete_one({"id": document_id})
    return {"message": "Document deleted successfully"}

# ============= MEETING SCHEDULER ENDPOINTS =============

@api_router.post("/properties/{property_id}/meetings", response_model=Meeting)
async def create_meeting(
    property_id: str,
    meeting_data: MeetingCreate,
    user_id: str = Depends(get_current_user)
):
    """Create a meeting (admin/committee/residents)"""
    await require_community(db, property_id, user_id)
    user = await db.users.find_one({"id": user_id})
    user_name = user.get('username', 'Unknown')
    
    meeting = Meeting(
        organizer_id=user_id,
        organizer_name=user_name,
        **scoped_data(meeting_data, "property_id", property_id)
    )
    await db.meetings.insert_one(meeting.dict())
    return meeting

@api_router.get("/properties/{property_id}/meetings")
async def get_meetings(
    property_id: str,
    user_id: str = Depends(get_current_user),
    upcoming: bool = True
):
    """Get meetings for a property"""
    await require_community(db, property_id, user_id)
    query = {"property_id": property_id}
    
    if upcoming:
        query["date"] = {"$gte": datetime.utcnow()}
    
    meetings = await db.meetings.find(query).sort("date", 1).to_list(length=1000)
    for m in meetings:
        if '_id' in m:
            m['_id'] = str(m['_id'])
    return meetings

@api_router.post("/meetings/rsvp", response_model=MeetingRSVP)
async def rsvp_meeting(
    rsvp_data: RSVPCreate,
    user_id: str = Depends(get_current_user)
):
    """RSVP to a meeting"""
    meeting = await db.meetings.find_one({"id": rsvp_data.meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_community(db, meeting["property_id"], user_id)
    user = await db.users.find_one({"id": user_id})
    user_name = user.get('username', 'Unknown') if user else 'Unknown'
    
    # Check if already RSVPed
    existing = await db.meeting_rsvps.find_one({
        "meeting_id": rsvp_data.meeting_id,
        "user_id": user_id
    })
    
    if existing:
        # Update existing RSVP
        await db.meeting_rsvps.update_one(
            {"meeting_id": rsvp_data.meeting_id, "user_id": user_id},
            {"$set": {"status": rsvp_data.status, "guests_count": rsvp_data.guests_count}}
        )
        existing['status'] = rsvp_data.status
        existing['guests_count'] = rsvp_data.guests_count
        if '_id' in existing:
            existing['_id'] = str(existing['_id'])
        return existing
    else:
        # Create new RSVP
        rsvp = MeetingRSVP(
            user_id=user_id,
            user_name=user_name,
            **rsvp_data.dict()
        )
        await db.meeting_rsvps.insert_one(rsvp.dict())
        return rsvp

@api_router.get("/meetings/{meeting_id}/rsvps")
async def get_meeting_rsvps(meeting_id: str, user_id: str = Depends(get_current_user)):
    """Get RSVPs for a meeting"""
    meeting = await db.meetings.find_one({"id": meeting_id})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await require_community(db, meeting["property_id"], user_id, {"admin"})
    rsvps = await db.meeting_rsvps.find({"meeting_id": meeting_id}).to_list(length=1000)
    for r in rsvps:
        if '_id' in r:
            r['_id'] = str(r['_id'])
    return rsvps

# ============= MAINTENANCE DUES ENDPOINTS =============

@api_router.post("/properties/{property_id}/dues")
async def create_maintenance_due(
    property_id: str,
    due_data: MaintenanceDueCreate,
    user_id: str = Depends(get_current_user)
):
    """Send maintenance due to individual resident (admin only)"""
    await require_community(db, property_id, user_id, {"admin"})
    # Check if user is admin of this property
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_super_admin = user_doc.get("is_super_admin", False)
    admin_assignment = await db.property_admin_assignments.find_one({
        "admin_user_id": user_id,
        "property_id": property_id
    })
    
    if not is_super_admin and not admin_assignment:
        raise HTTPException(status_code=403, detail="Not authorized to send dues")
    
    # Verify target user is member of this property
    membership = await db.property_memberships.find_one({
        "user_id": due_data.user_id,
        "property_id": property_id, "status": {"$in": ACTIVE_MEMBERSHIP_STATES}
    })
    if not membership:
        raise HTTPException(status_code=400, detail="User is not a member of this property")
    
    # Create due
    new_due = MaintenanceDue(
        property_id=property_id,
        user_id=due_data.user_id,
        amount=due_data.amount,
        due_date=due_data.due_date,
        description=due_data.description,
        created_by=user_id
    )
    
    await db.maintenance_dues.insert_one(new_due.dict())
    return {"message": "Maintenance due created successfully", "id": new_due.id}

@api_router.post("/properties/{property_id}/dues/bulk")
async def create_bulk_maintenance_dues(
    property_id: str,
    due_data: BulkMaintenanceDueCreate,
    user_id: str = Depends(get_current_user)
):
    """Send maintenance dues to all residents of property (admin only)"""
    await require_community(db, property_id, user_id, {"admin"})
    # Check if user is admin of this property
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_super_admin = user_doc.get("is_super_admin", False)
    admin_assignment = await db.property_admin_assignments.find_one({
        "admin_user_id": user_id,
        "property_id": property_id
    })
    
    if not is_super_admin and not admin_assignment:
        raise HTTPException(status_code=403, detail="Not authorized to send dues")
    
    # Get all residents of this property
    memberships = await db.property_memberships.find({"property_id": property_id, "status": {"$in": ACTIVE_MEMBERSHIP_STATES}}).to_list(length=1000)
    
    if not memberships:
        raise HTTPException(status_code=400, detail="No residents found for this property")
    
    # Create dues for all residents
    created_count = 0
    for membership in memberships:
        new_due = MaintenanceDue(
            property_id=property_id,
            user_id=membership["user_id"],
            amount=due_data.amount,
            due_date=due_data.due_date,
            description=due_data.description,
            created_by=user_id
        )
        await db.maintenance_dues.insert_one(new_due.dict())
        created_count += 1
    
    return {"message": f"Maintenance dues created for {created_count} residents", "count": created_count}

@api_router.get("/properties/{property_id}/dues")
async def get_property_dues(
    property_id: str,
    status: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    """Get all maintenance dues for a property (admin only)"""
    await require_community(db, property_id, user_id, {"admin"})
    # Check if user is admin of this property
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_super_admin = user_doc.get("is_super_admin", False)
    admin_assignment = await db.property_admin_assignments.find_one({
        "admin_user_id": user_id,
        "property_id": property_id
    })
    
    if not is_super_admin and not admin_assignment:
        raise HTTPException(status_code=403, detail="Not authorized to view dues")
    
    # Build query
    query = {"property_id": property_id}
    if status:
        query["status"] = status
    
    dues = await db.maintenance_dues.find(query).sort("due_date", -1).to_list(length=1000)
    
    # Enrich with user details
    result = []
    for due in dues:
        if '_id' in due:
            due['_id'] = str(due['_id'])
        
        # Get user details
        user = await db.users.find_one({"id": due["user_id"]})
        if user:
            due["username"] = user.get("username")
            due["email"] = user.get("email")
        
        result.append(due)
    
    return result

@api_router.get("/users/dues")
async def get_user_dues(user_id: str = Depends(get_current_user)):
    """Get current user's maintenance dues"""
    dues = await db.maintenance_dues.find({"user_id": user_id}).sort("due_date", -1).to_list(length=1000)
    
    for due in dues:
        if '_id' in due:
            due['_id'] = str(due['_id'])
        
        # Get property details
        property_doc = await db.community_properties.find_one({"id": due["property_id"]})
        if property_doc:
            due["property_name"] = property_doc.get("name")
            due["property_address"] = property_doc.get("address")
    
    return dues

@api_router.put("/dues/{due_id}")
async def update_maintenance_due(
    due_id: str,
    due_update: MaintenanceDueUpdate,
    user_id: str = Depends(get_current_user)
):
    """Update maintenance due status (user marks as paid)"""
    due_doc = await db.maintenance_dues.find_one({"id": due_id})
    if not due_doc:
        raise HTTPException(status_code=404, detail="Maintenance due not found")
    
    # Only allow user to update their own dues
    if due_doc["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this due")
    
    update_data = {k: v for k, v in due_update.dict().items() if v is not None}
    
    if update_data:
        await db.maintenance_dues.update_one(
            {"id": due_id},
            {"$set": update_data}
        )
    
    return {"message": "Maintenance due updated successfully"}

@api_router.delete("/dues/{due_id}")
async def delete_maintenance_due(
    due_id: str,
    user_id: str = Depends(get_current_user)
):
    """Delete maintenance due (admin only)"""
    due_doc = await db.maintenance_dues.find_one({"id": due_id})
    if not due_doc:
        raise HTTPException(status_code=404, detail="Maintenance due not found")
    
    # Check if user is admin of the property
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_super_admin = user_doc.get("is_super_admin", False)
    admin_assignment = await db.property_admin_assignments.find_one({
        "admin_user_id": user_id,
        "property_id": due_doc["property_id"]
    })
    
    if not is_super_admin and not admin_assignment:
        raise HTTPException(status_code=403, detail="Not authorized to delete this due")
    
    await db.maintenance_dues.delete_one({"id": due_id})
    return {"message": "Maintenance due deleted successfully"}

# ============= ADMIN ENDPOINTS =============

# Helper function to check if user is super admin
async def verify_super_admin(user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user_id

# Helper function to check if user is HOA admin for a property
async def verify_hoa_admin(property_id: str, user_id: str):
    await require_community(db, property_id, user_id, {"admin"})
    return True

# -------- SUPER ADMIN ENDPOINTS --------

@api_router.post("/admin/super/assign-hoa-admin")
async def assign_hoa_admin(
    target_user_id: str,
    property_id: str,
    super_admin_id: str = Depends(verify_super_admin)
):
    """Super admin assigns HOA admin to a property"""
    
    # Verify target user exists
    target_user = await db.users.find_one({"id": target_user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    # Verify property exists
    property_doc = await db.properties.find_one({"id": property_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Update user to be HOA admin
    await db.users.update_one(
        {"id": target_user_id},
        {"$set": {"is_hoa_admin": True}}
    )
    
    # Create admin assignment
    assignment = PropertyAdminAssignment(
        admin_user_id=target_user_id,
        property_id=property_id,
        assigned_by=super_admin_id
    )
    
    await db.property_admin_assignments.insert_one(assignment.dict())
    
    return {"message": "HOA admin assigned successfully", "assignment_id": assignment.id}

@api_router.delete("/admin/super/remove-hoa-admin")
async def remove_hoa_admin(
    target_user_id: str,
    property_id: str,
    super_admin_id: str = Depends(verify_super_admin)
):
    """Super admin removes HOA admin from a property"""
    
    # Delete admin assignment
    result = await db.property_admin_assignments.delete_one({
        "admin_user_id": target_user_id,
        "property_id": property_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Admin assignment not found")
    
    # Check if user has any other property assignments
    other_assignments = await db.property_admin_assignments.find_one({"admin_user_id": target_user_id})
    
    # If no other assignments, remove HOA admin status
    if not other_assignments:
        await db.users.update_one(
            {"id": target_user_id},
            {"$set": {"is_hoa_admin": False}}
        )
    
    return {"message": "HOA admin removed successfully"}

@api_router.get("/admin/super/all-properties")
async def get_all_properties_admin(super_admin_id: str = Depends(verify_super_admin)):
    """Get all properties in the system"""
    properties = await db.properties.find({}).to_list(length=1000)
    for prop in properties:
        if '_id' in prop:
            prop['_id'] = str(prop['_id'])
    return properties

@api_router.get("/admin/super/all-admins")
async def get_all_admins(super_admin_id: str = Depends(verify_super_admin)):
    """Get all HOA admins and their assigned properties"""
    admins = await db.users.find({"is_hoa_admin": True}).to_list(length=1000)
    
    if not admins:
        return []
    
    # Batch fetch all assignments (single query instead of N queries)
    admin_ids = [admin["id"] for admin in admins]
    all_assignments = await db.property_admin_assignments.find(
        {"admin_user_id": {"$in": admin_ids}}
    ).to_list(length=None)
    
    # Group assignments by admin_user_id
    assignments_by_admin = {}
    for assignment in all_assignments:
        admin_id = assignment["admin_user_id"]
        if admin_id not in assignments_by_admin:
            assignments_by_admin[admin_id] = []
        assignments_by_admin[admin_id].append(assignment)
    
    result = []
    for admin in admins:
        assignments = assignments_by_admin.get(admin["id"], [])
        property_ids = [a["property_id"] for a in assignments]
        
        result.append({
            "id": admin["id"],
            "username": admin["username"],
            "email": admin.get("email"),
            "managed_properties": property_ids
        })
    
    return result

@api_router.get("/admin/super/all-users")
async def get_all_users(super_admin_id: str = Depends(verify_super_admin)):
    """Get all users in the system"""
    users = await db.users.find({}).to_list(length=1000)
    
    result = []
    for user in users:
        result.append({
            "id": user["id"],
            "username": user["username"],
            "email": user.get("email"),
            "is_hoa_admin": user.get("is_hoa_admin", False),
            "is_super_admin": user.get("is_super_admin", False)
        })
    
    return result

# ============= SUPER ADMIN - COMMUNITY PROPERTY MANAGEMENT =============

@api_router.post("/admin/super/community-properties")
async def create_community_property(
    property_data: CommunityPropertyCreate,
    super_admin_id: str = Depends(verify_super_admin)
):
    """Create a new community property for registration"""
    new_property = CommunityProperty(
        **property_data.dict(),
        created_by=super_admin_id
    )
    
    await db.community_properties.insert_one(new_property.dict())
    return {"message": "Community property created successfully", "id": new_property.id}

@api_router.get("/admin/super/community-properties")
async def get_all_community_properties(super_admin_id: str = Depends(verify_super_admin)):
    """Get all community properties"""
    properties = await db.community_properties.find({}).to_list(length=1000)
    for prop in properties:
        if '_id' in prop:
            prop['_id'] = str(prop['_id'])
    return properties

@api_router.get("/admin/super/community-properties/{property_id}")
async def get_community_property(
    property_id: str,
    super_admin_id: str = Depends(verify_super_admin)
):
    """Get single community property with builder page details"""
    property_doc = await db.community_properties.find_one({"id": property_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Community property not found")
    
    if '_id' in property_doc:
        property_doc['_id'] = str(property_doc['_id'])
    
    return property_doc

@api_router.put("/admin/super/community-properties/{property_id}")
async def update_community_property(
    property_id: str,
    property_update: CommunityPropertyUpdate,
    super_admin_id: str = Depends(verify_super_admin)
):
    """Update community property including logo and builder page"""
    property_doc = await db.community_properties.find_one({"id": property_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Community property not found")
    
    update_data = {k: v for k, v in property_update.dict().items() if v is not None}
    
    if update_data:
        await db.community_properties.update_one(
            {"id": property_id},
            {"$set": update_data}
        )
    
    return {"message": "Community property updated successfully"}

@api_router.delete("/admin/super/community-properties/{property_id}")
async def delete_community_property(
    property_id: str,
    super_admin_id: str = Depends(verify_super_admin)
):
    """Delete community property"""
    result = await db.community_properties.delete_one({"id": property_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Community property not found")
    
    return {"message": "Community property deleted successfully"}

# -------- HOA ADMIN ENDPOINTS --------

@api_router.get("/admin/properties/{property_id}/dashboard", response_model=AdminDashboardStats)
async def get_admin_dashboard(
    property_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get dashboard statistics for HOA admin"""
    await verify_hoa_admin(property_id, user_id)
    
    # Count total users
    memberships = await db.property_memberships.find({"property_id": property_id}).to_list(length=10000)
    total_users = len(memberships)
    active_residents = len([m for m in memberships if m.get("status") == "active"])
    
    # Count pending approvals
    pending_approvals = await db.pending_user_approvals.count_documents({
        "property_id": property_id,
        "status": "pending"
    })
    
    # Count payment requests
    payment_requests_sent = await db.hoa_maintenance_charges.count_documents({"property_id": property_id})
    charges = await db.hoa_maintenance_charges.find({"property_id": property_id}, {"id": 1}).to_list(length=None)
    payments_received = await db.payments.count_documents({
        "charge_id": {"$in": [charge["id"] for charge in charges]}, "status": "paid"})
    
    # Calculate unpaid amount
    unpaid_charges = await db.hoa_maintenance_charges.find({
        "property_id": property_id,
        "status": "unpaid"
    }).to_list(length=10000)
    unpaid_amount = sum(charge.get("amount", 0) for charge in unpaid_charges)
    
    # Count recent posts (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_posts = await db.community_posts.count_documents({
        "property_id": property_id,
        "created_at": {"$gte": seven_days_ago}
    })
    
    # Count upcoming meetings
    upcoming_meetings = await db.hoa_meetings.count_documents({
        "property_id": property_id,
        "date": {"$gte": datetime.utcnow()}
    })
    
    return AdminDashboardStats(
        property_id=property_id,
        total_users=total_users,
        pending_approvals=pending_approvals,
        active_residents=active_residents,
        payment_requests_sent=payment_requests_sent,
        payments_received=payments_received,
        unpaid_amount=unpaid_amount,
        recent_posts=recent_posts,
        upcoming_meetings=upcoming_meetings
    )

@api_router.get("/admin/properties/{property_id}/pending-approvals")
async def get_pending_approvals(
    property_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get all pending user approvals for a property"""
    await verify_hoa_admin(property_id, user_id)
    
    approvals = await db.pending_user_approvals.find({
        "property_id": property_id,
        "status": "pending"
    }).to_list(length=1000)
    
    for approval in approvals:
        if '_id' in approval:
            approval['_id'] = str(approval['_id'])
    
    return approvals

@api_router.post("/admin/properties/{property_id}/approve-user")
async def approve_or_reject_user(property_id: str, action: ApprovalAction, user_id: str = Depends(get_current_user)):
    await verify_hoa_admin(property_id, user_id)
    approval = await db.pending_user_approvals.find_one({"id": action.approval_id, "property_id": property_id})
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found in this community")
    target = await db.users.find_one({"id": approval["user_id"]})
    if not target or target.get("deletion_pending") or target.get("disabled"):
        raise HTTPException(status_code=409, detail="Applicant account is unavailable")
    approved = action.action == "approve"
    status_value = "active" if approved else "rejected"
    decision = "approved" if approved else "rejected"
    claimed = await db.pending_user_approvals.update_one(
        {"id": action.approval_id, "property_id": property_id, "status": "pending"},
        {"$set": {"status": decision, "admin_notes": action.admin_notes,
            "reviewed_at": datetime.utcnow(), "reviewed_by": user_id,
            "documents": [], "document_names": [], "membership_applied": False}})
    if not claimed.modified_count:
        current = await db.pending_user_approvals.find_one({"id": action.approval_id, "property_id": property_id})
        if not current or current["status"] != decision or current.get("membership_applied", True):
            raise HTTPException(status_code=409, detail="Approval already processed")
    # The atomic decision prevents simultaneous approve/reject from granting access.
    # An interrupted application can retry the same decision safely.
    # Membership is the access source of truth; retried updates are idempotent.
    await db.property_memberships.update_one({"user_id": approval["user_id"], "property_id": property_id},
        {"$set": {"status": status_value, "role": approval["requested_role"],
            "approved_by": user_id, "approved_at": datetime.utcnow()}, "$setOnInsert": {
                "id": str(uuid.uuid4()), "user_id": approval["user_id"], "property_id": property_id,
                "joined_at": datetime.utcnow()}}, upsert=True)
    await db.users.update_one({"id": approval["user_id"]},
        {"$addToSet" if approved else "$pull": {"member_properties": property_id}})
    await db.pending_user_approvals.update_one({"id": action.approval_id, "property_id": property_id},
        {"$set": {"membership_applied": True}})
    return {"message": "User approved" if approved else "User rejected"}

@api_router.post("/admin/properties/{property_id}/create-payment-request", response_model=HOACharge)
async def create_payment_request_admin(
    property_id: str,
    target_user_id: str,
    amount: float,
    title: str,
    description: str,
    due_date: str,
    user_id: str = Depends(get_current_user)
):
    """HOA admin creates a payment request for a user"""
    await verify_hoa_admin(property_id, user_id)
    
    # Verify target user is a member
    membership = await db.property_memberships.find_one({
        "user_id": target_user_id,
        "property_id": property_id, "status": {"$in": ACTIVE_MEMBERSHIP_STATES}
    })
    
    if not membership:
        raise HTTPException(status_code=404, detail="User not a member of this property")
    
    # Create payment request
    charge = HOACharge(
        property_id=property_id,
        user_id=target_user_id,
        created_by=user_id,
        amount=amount,
        title=title,
        description=description,
        due_date=datetime.fromisoformat(due_date.replace('Z', '+00:00')),
        status="unpaid"
    )
    
    await db.hoa_maintenance_charges.insert_one(charge.dict())
    
    # TODO: Send push notification to user
    
    return charge

@api_router.post("/admin/properties/{property_id}/create-post", response_model=CommunityPost)
async def create_post_admin(
    property_id: str,
    post: CommunityPostCreate,
    user_id: str = Depends(get_current_user)
):
    """HOA admin creates a community post/announcement"""
    await require_content_terms(db, user_id)
    validate_content(post.title, post.content)
    await verify_hoa_admin(property_id, user_id)
    
    # Get admin info
    admin = await db.users.find_one({"id": user_id})
    
    post_data = scoped_data(post, "property_id", property_id)
    post_data.pop("property_id")  # Remove property_id from post data to avoid duplicate
    
    new_post = CommunityPost(
        property_id=property_id,
        user_id=user_id,
        user_name=admin.get('username', 'Admin'),
        user_role="admin",
        is_admin_post=True,
        is_pinned=True if post.category == "announcement" else False,
        **post_data
    )
    
    await db.community_posts.insert_one(new_post.dict())
    
    # TODO: Send push notification to all property members
    
    return new_post

@api_router.get("/admin/properties/{property_id}/payments")
async def get_all_payments(
    property_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get all payment requests and their status"""
    await verify_hoa_admin(property_id, user_id)
    
    charges = await db.hoa_maintenance_charges.find({"property_id": property_id}).to_list(length=1000)
    
    result = []
    for charge in charges:
        # Get user info
        user = await db.users.find_one({"id": charge["user_id"]})
        
        # Get payment if exists
        payment = await db.payments.find_one({"charge_id": charge["id"]})
        
        result.append({
            "charge_id": charge["id"],
            "user_name": user.get("username") if user else "Unknown",
            "user_email": user.get("email") if user else None,
            "amount": charge["amount"],
            "title": charge["title"],
            "due_date": charge["due_date"],
            "status": charge["status"],
            "payment_date": payment.get("created_at") if payment else None,
            "created_at": charge["created_at"]
        })
    
    return result

# -------- USER APPROVAL REQUEST ENDPOINT --------

@api_router.post("/user/request-property-approval")
async def request_property_approval(request: ApprovalRequest, user_id: str = Depends(get_current_user)):
    if len(request.documents) != len(request.document_names) or len(request.documents) > 2:
        raise HTTPException(status_code=400, detail="Provide up to two documents with matching names")
    if sum(len(d) for d in request.documents) > 14_000_000:
        raise HTTPException(status_code=413, detail="Documents are too large")
    return await submit_membership_request(request.property_id, user_id, request.requested_role, request.documents, request.document_names)

@api_router.get("/user/approval-status/{property_id}")
async def get_approval_status(property_id: str, user_id: str = Depends(get_current_user)):
    membership = await db.property_memberships.find_one({"user_id": user_id, "property_id": property_id})
    approval = await db.pending_user_approvals.find_one({"user_id": user_id, "property_id": property_id})
    if membership and membership.get("status") == "active":
        return {"status": "approved"}
    return {"status": membership.get("status", "not_submitted") if membership else (approval or {}).get("status", "not_submitted"),
        "admin_notes": (approval or {}).get("admin_notes")}


class AIConsentRequest(BaseModel):
    accepted: bool

@api_router.post("/auth/ai-consent")
async def update_ai_consent(payload: AIConsentRequest, user_id: str = Depends(get_current_user)):
    await db.users.update_one({"id": user_id}, {"$set": {"ai_consent_at": datetime.utcnow() if payload.accepted else None}})
    return {"accepted": payload.accepted}

async def require_ai_consent(user_id):
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("ai_consent_at"):
        raise HTTPException(status_code=403, detail="Consent is required before sending information to AI providers")

app.include_router(api_router)
app.include_router(moderation_router(db, get_current_user))

@app.on_event("startup")
async def start_security_services():
    # Unique keys prevent duplicate memberships, reports and replayed OAuth exchanges.
    await db.password_resets.create_index("email", unique=True)
    await db.password_resets.create_index("expires_at", expireAfterSeconds=0)
    await db.user_sessions.create_index("jti", unique=True, sparse=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.oauth_exchanges.create_index("id", unique=True)
    await db.apple_challenges.create_index("expires_at", expireAfterSeconds=0)
    await db.apple_challenges.create_index("id", unique=True)
    await db.account_deletions.create_index("expires_at", expireAfterSeconds=0)
    await db.property_memberships.create_index([("user_id", 1), ("property_id", 1)], unique=True)
    await db.pending_user_approvals.create_index([("user_id", 1), ("property_id", 1)], unique=True)
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email", unique=True, partialFilterExpression={"email": {"$type": "string"}})
    await db.community_blocks.create_index([("user_id", 1), ("blocked_user_id", 1)], unique=True)
    app.state.deletion_worker = asyncio.create_task(deletion_worker())


# ============= ERROR MONITORING & ALERTING =============
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time

class ErrorMonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware to track and alert on endpoint failures"""
    
    def __init__(self, app, alert_threshold: int = 5):
        super().__init__(app)
        self.alert_threshold = alert_threshold
        self.error_counts = defaultdict(int)  # endpoint -> error count
        self.error_window = defaultdict(list)  # endpoint -> list of error timestamps
        self.window_duration = 300  # 5 minutes window
        self.alerted_endpoints = set()  # Track which endpoints have been alerted
        
    async def dispatch(self, request: Request, call_next):
        endpoint = f"{request.method} {request.url.path}"
        
        try:
            response = await call_next(request)
            
            # Track errors (5xx status codes)
            if response.status_code >= 500:
                await self.track_error(endpoint)
            # Reset on success
            elif response.status_code < 400:
                await self.reset_error_count(endpoint)
                
            return response
        except Exception as e:
            await self.track_error(endpoint)
            raise
    
    async def track_error(self, endpoint: str):
        """Track error for an endpoint and trigger alert if threshold exceeded"""
        current_time = time.time()
        
        # Add error to window
        if endpoint not in self.error_window:
            self.error_window[endpoint] = []
        self.error_window[endpoint].append(current_time)
        
        # Clean old errors outside window
        self.error_window[endpoint] = [
            t for t in self.error_window[endpoint] 
            if current_time - t < self.window_duration
        ]
        
        # Count errors in current window
        error_count = len(self.error_window[endpoint])
        
        # Trigger alert if threshold exceeded and not already alerted
        if error_count >= self.alert_threshold and endpoint not in self.alerted_endpoints:
            self.alerted_endpoints.add(endpoint)
            await self.trigger_alert(endpoint, error_count)
    
    async def reset_error_count(self, endpoint: str):
        """Reset error count on successful request"""
        if endpoint in self.error_window:
            self.error_window[endpoint] = []
        if endpoint in self.alerted_endpoints:
            self.alerted_endpoints.remove(endpoint)
            logger.info(f"✅ ALERT CLEARED: {endpoint} is now working correctly")
    
    async def trigger_alert(self, endpoint: str, error_count: int):
        """Trigger alert for endpoint with too many errors"""
        alert_message = f"""
╔══════════════════════════════════════════════════════════════╗
║  🚨 CRITICAL ALERT: HIGH ERROR RATE DETECTED                 ║
╠══════════════════════════════════════════════════════════════╣
║  Endpoint: {endpoint:<50} ║
║  Error Count: {error_count} errors in last 5 minutes          ║
║  Threshold: {self.alert_threshold} errors                      ║
║  Status: REQUIRES IMMEDIATE ATTENTION                        ║
╚══════════════════════════════════════════════════════════════╝
        """
        logger.error(alert_message)
        
        # Additional: Could send to external monitoring service, Slack, email, etc.
        # await send_to_slack(alert_message)
        # await send_email_alert(endpoint, error_count)

# Add error monitoring middleware
app.add_middleware(ErrorMonitoringMiddleware, alert_threshold=5)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    if IS_PRODUCTION:
        # Security headers for production
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# CORS configuration - restrict in production
if IS_PRODUCTION:
    # In production, specify exact origins
    allowed_origins = os.getenv('ALLOWED_ORIGINS', '').split(',')
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=allowed_origins if allowed_origins else ["https://yourdomain.com"],
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type", "Authorization", "X-Session-ID"],
    )
else:
    # Development - allow all
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.on_event("shutdown")
async def shutdown_db_client():
    worker = getattr(app.state, "deletion_worker", None)
    if worker:
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass
    client.close()
