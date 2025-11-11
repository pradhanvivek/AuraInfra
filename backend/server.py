from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from pathlib import Path
import os
import logging
import uuid
import jwt
import bcrypt
import base64
from bson import ObjectId

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
security = HTTPBearer()

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============= MODELS =============

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

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
    currency_preference: Optional[str] = None  # "USD", "INR", "EUR", etc.
    measurement_system: Optional[str] = None  # "imperial" or "metric"
    is_super_admin: bool = False
    is_hoa_admin: bool = False
    managed_properties: Optional[List[str]] = []  # List of property IDs
    disclaimer_accepted: bool = False
    disclaimer_accepted_at: Optional[datetime] = None
    created_at: datetime

class UserProfileUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None  # base64 encoded image
    warranty_reminder_days: Optional[int] = None
    geomancy_preference: Optional[str] = None  # "vastu" or "feng_shui"
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

class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    logo: Optional[str] = None  # base64 encoded image

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

# Property Membership & Roles
class PropertyMembership(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    user_id: str
    role: str  # "owner", "tenant", "resident"
    status: str = "active"  # "active", "inactive", "pending"
    joined_date: datetime = Field(default_factory=datetime.utcnow)
    end_date: Optional[datetime] = None

class PropertyMembershipCreate(BaseModel):
    property_id: str
    role: str  # "owner", "tenant", "resident"
    status: str = "active"

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
    status: str  # "approved", "rejected"
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
    status: Optional[str] = None
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
    file_url: Optional[str] = None  # URL or base64
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
    requested_role: str
    documents: List[str]  # base64 documents
    document_names: List[str]

class ApprovalAction(BaseModel):
    approval_id: str
    action: str  # "approve" or "reject"
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
    expire = datetime.utcnow() + timedelta(days=30)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        logger.info(f"Attempting to verify token (length: {len(token)})")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        logger.info(f"Token verified successfully for user: {payload.get('user_id')}")
        return payload
    except jwt.ExpiredSignatureError as e:
        logger.error(f"Token expired: {str(e)}")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Token verification error: {type(e).__name__} - {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id

# ============= AUTH ENDPOINTS =============

@api_router.post("/auth/register", response_model=Token)
async def register(user: UserRegister):
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
        "managed_properties": [],
        "disclaimer_accepted": False,
        "disclaimer_accepted_at": None,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create token
    access_token = create_access_token({"user_id": user_id, "username": user.username})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user_id,
        username=user.username
    )

@api_router.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    # Find user by username or email
    # Check if the input contains '@' to determine if it's an email
    if '@' in user.username:
        # Search by email
        user_doc = await db.users.find_one({"email": user.username})
    else:
        # Search by username
        user_doc = await db.users.find_one({"username": user.username})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not bcrypt.checkpw(user.password.encode('utf-8'), user_doc["password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create token
    access_token = create_access_token({"user_id": user_doc["id"], "username": user_doc["username"]})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user_doc["id"],
        username=user_doc["username"]
    )

@api_router.get("/auth/profile", response_model=UserProfile)
async def get_profile(user_id: str = Depends(get_current_user)):
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get managed properties if user is HOA admin
    managed_properties = []
    if user_doc.get("is_hoa_admin"):
        admin_assignments = await db.property_admin_assignments.find({"admin_user_id": user_id}).to_list(length=100)
        managed_properties = [assignment["property_id"] for assignment in admin_assignments]
    
    return UserProfile(
        id=user_doc["id"],
        username=user_doc["username"],
        email=user_doc.get("email"),
        phone=user_doc.get("phone"),
        avatar=user_doc.get("avatar"),
        warranty_reminder_days=user_doc.get("warranty_reminder_days", 30),
        geomancy_preference=user_doc.get("geomancy_preference", "vastu"),
        currency_preference=user_doc.get("currency_preference"),
        measurement_system=user_doc.get("measurement_system"),
        is_super_admin=user_doc.get("is_super_admin", False),
        is_hoa_admin=user_doc.get("is_hoa_admin", False),
        managed_properties=managed_properties,
        created_at=user_doc["created_at"]
    )

@api_router.put("/auth/profile", response_model=UserProfile)
async def update_profile(profile: UserProfileUpdate, user_id: str = Depends(get_current_user)):
    # Update user profile
    update_data = {}
    if profile.email is not None:
        update_data["email"] = profile.email
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
    
    if update_data:
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
    
    # Return updated profile
    user_doc = await db.users.find_one({"id": user_id})
    return UserProfile(
        id=user_doc["id"],
        username=user_doc["username"],
        email=user_doc.get("email"),
        phone=user_doc.get("phone"),
        avatar=user_doc.get("avatar"),
        warranty_reminder_days=user_doc.get("warranty_reminder_days", 30),
        geomancy_preference=user_doc.get("geomancy_preference", "vastu"),
        currency_preference=user_doc.get("currency_preference"),
        measurement_system=user_doc.get("measurement_system"),
        created_at=user_doc["created_at"]
    )

# ============= GOOGLE OAUTH SESSION ENDPOINTS =============

import httpx
from fastapi.responses import JSONResponse
from datetime import timezone

# Helper function to get user from session token (checks both cookie and header)
async def get_user_from_session(request: Request):
    """Get user from session token (cookie or Authorization header)"""
    # First check cookie
    session_token = request.cookies.get("session_token")
    
    # Fall back to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session in database
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check if session expired
    # Make both datetimes timezone-aware for comparison
    expires_at = session["expires_at"]
    if not expires_at.tzinfo:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one({"id": session["user_id"]})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user_doc

@api_router.post("/auth/session")
async def process_session_id(request: Request):
    """Process session_id from Emergent Auth and create user session"""
    try:
        # Get session_id from header
        session_id = request.headers.get("X-Session-ID")
        if not session_id:
            raise HTTPException(status_code=400, detail="Missing X-Session-ID header")
        
        # Call Emergent Auth API to get user data
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session ID")
            
            google_user_data = response.json()
        
        # Check if user exists by email
        existing_user = await db.users.find_one({"email": google_user_data["email"]})
        
        if existing_user:
            user_id = existing_user["id"]
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            user_doc = {
                "id": user_id,
                "username": google_user_data["email"].split("@")[0],  # Use email prefix as username
                "email": google_user_data["email"],
                "name": google_user_data.get("name", ""),
                "avatar": google_user_data.get("picture"),
                "warranty_reminder_days": 30,
                "geomancy_preference": "vastu",
                "is_super_admin": False,
                "is_hoa_admin": False,
                "managed_properties": [],
                "created_at": datetime.now(timezone.utc),
                "auth_provider": "google"
            }
            await db.users.insert_one(user_doc)
        
        # Create session in database
        session_token = google_user_data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        }
        await db.user_sessions.insert_one(session_doc)
        
        # Create response with cookie
        response = JSONResponse({
            "id": user_id,
            "email": google_user_data["email"],
            "name": google_user_data.get("name", ""),
            "picture": google_user_data.get("picture"),
            "session_token": session_token
        })
        
        # Set httpOnly cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
        
        return response
        
    except httpx.RequestError as e:
        logger.error(f"Error calling Emergent Auth API: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication service error")
    except Exception as e:
        logger.error(f"Session processing error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/auth/me")
async def get_current_session_user(request: Request):
    """Get current user from session"""
    user_doc = await get_user_from_session(request)
    return {
        "id": user_doc["id"],
        "username": user_doc.get("username"),
        "email": user_doc.get("email"),
        "name": user_doc.get("name"),
        "avatar": user_doc.get("avatar"),
        "warranty_reminder_days": user_doc.get("warranty_reminder_days", 30),
        "geomancy_preference": user_doc.get("geomancy_preference", "vastu"),
        "currency_preference": user_doc.get("currency_preference"),
        "measurement_system": user_doc.get("measurement_system"),
        "disclaimer_accepted": user_doc.get("disclaimer_accepted", False),
        "disclaimer_accepted_at": user_doc.get("disclaimer_accepted_at"),
    }

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
async def logout(request: Request):
    """Logout user and clear session"""
    try:
        session_token = request.cookies.get("session_token")
        if session_token:
            await db.user_sessions.delete_one({"session_token": session_token})
        
        response = JSONResponse({"message": "Logged out successfully"})
        response.delete_cookie(key="session_token", path="/")
        return response
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        raise HTTPException(status_code=500, detail="Logout failed")

# ============= ADMIN ENDPOINTS =============

@api_router.get("/admin/stats")
async def get_admin_stats(user_id: str = Depends(get_current_user)):
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
        user_id=user_id
    )
    await db.properties.insert_one(property_obj.dict())
    return property_obj

@api_router.get("/properties", response_model=List[Property])
async def get_properties(user_id: str = Depends(get_current_user)):
    properties = await db.properties.find({"user_id": user_id}).to_list(1000)
    return [Property(**prop) for prop in properties]

@api_router.get("/properties/{property_id}", response_model=Property)
async def get_property(property_id: str, user_id: str = Depends(get_current_user)):
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    return Property(**property_doc)

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
        properties_cursor = db.properties.find({"user_id": user_id})
        properties = await properties_cursor.to_list(length=1000)
        properties_value = sum(
            safe_float(p.get('current_value')) or safe_float(p.get('purchase_cost', 0)) 
            for p in properties
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
            logger.error(f"Raw response: {response}")
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
        logger.info(f"Appliance scan response: {response_text}")
        
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

# ============= PAINT ESTIMATION ENDPOINTS =============

@api_router.post("/paint-estimation/analyze-wall", response_model=PaintEstimate)
async def analyze_wall_for_painting(
    scan_request: WallScanRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Use Gemini Vision AI to estimate wall dimensions and calculate paint requirements
    """
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
        logger.info(f"Wall scan response: {response}")
        
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
        logger.info(f"Room scan response: {response}")
        
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
        logger.info(f"Gemini response: {response}")
        
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
            logger.error(f"JSON parsing error: {str(je)}, Response: {response}")
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
async def scan_asset(request: ImageScanRequest, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Identify what type of asset is in an image using Gemini AI
    """
    import json
    
    try:
        user_id = await get_current_user(credentials)
        
        # Get API key
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        # Use Gemini to identify the asset type
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        # Create the chat instance
        llm_chat = LlmChat(
            api_key=api_key,
            session_id=f"asset_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert at identifying physical assets and objects."
        ).with_model("gemini", "gemini-2.0-flash-exp")
        
        # Create the prompt
        prompt = """Look at this image and identify what type of asset it is.
        
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
        
        Choose the MOST appropriate category. Return ONLY the JSON, no other text."""
        
        # Create the message with image
        image_content = ImageContent(
            image_base64=request.image
        )
        
        message = UserMessage([prompt, image_content])
        
        # Get AI response
        response = llm_chat.ask(message)
        response_text = response.content.strip()
        
        # Parse the JSON response
        # Remove markdown code blocks if present
        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
            response_text = response_text.strip()
        
        result = json.loads(response_text)
        
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

@api_router.post("/properties/{property_id}/members", response_model=PropertyMembership)
async def add_property_member(
    property_id: str,
    membership_data: PropertyMembershipCreate,
    user_id: str = Depends(get_current_user)
):
    """Add a member to a property (owner only)"""
    # Verify user is owner of the property
    property_doc = await db.properties.find_one({"id": property_id})
    if not property_doc or property_doc.get('user_id') != user_id:
        raise HTTPException(status_code=403, detail="Only property owner can add members")
    
    membership = PropertyMembership(
        property_id=property_id,
        **membership_data.dict()
    )
    await db.property_memberships.insert_one(membership.dict())
    return membership

@api_router.get("/properties/{property_id}/members")
async def get_property_members(
    property_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get all members of a property with user details"""
    # Verify user has access to this property
    has_access = await db.property_memberships.find_one({
        "property_id": property_id,
        "user_id": user_id
    })
    
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    
    # Also check if user is HOA admin for this property
    is_admin = False
    user_doc = await db.users.find_one({"id": user_id})
    if user_doc and user_doc.get("is_hoa_admin"):
        admin_assignment = await db.property_admin_assignments.find_one({
            "admin_user_id": user_id,
            "property_id": property_id
        })
        is_admin = admin_assignment is not None
    
    if not has_access and not property_doc and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    members = await db.property_memberships.find({"property_id": property_id}).to_list(length=1000)
    
    # Enrich with user details
    result = []
    for m in members:
        user = await db.users.find_one({"id": m["user_id"]})
        if user:
            result.append({
                "id": m["id"],
                "user_id": m["user_id"],
                "username": user.get("username", "Unknown"),
                "email": user.get("email"),
                "role": m.get("role", "resident"),
                "status": m.get("status", "active")
            })
    
    return result

@api_router.get("/users/properties")
async def get_user_properties(user_id: str = Depends(get_current_user)):
    """Get all properties user has access to (owned + member)"""
    # Get owned properties
    owned = await db.properties.find({"user_id": user_id}).to_list(length=1000)
    
    # Get properties where user is member
    memberships = await db.property_memberships.find({
        "user_id": user_id,
        "status": "active"
    }).to_list(length=1000)
    
    member_property_ids = [m['property_id'] for m in memberships]
    member_properties = []
    
    if member_property_ids:
        member_properties = await db.properties.find({
            "id": {"$in": member_property_ids}
        }).to_list(length=1000)
    
    # Combine and mark role
    all_properties = []
    for prop in owned:
        prop['user_role'] = 'owner'
        if '_id' in prop:
            prop['_id'] = str(prop['_id'])
        all_properties.append(prop)
    
    for prop in member_properties:
        # Find user's role for this property
        membership = next((m for m in memberships if m['property_id'] == prop['id']), None)
        prop['user_role'] = membership['role'] if membership else 'member'
        if '_id' in prop:
            prop['_id'] = str(prop['_id'])
        all_properties.append(prop)
    
    return all_properties

# ============= HOA CHARGES & PAYMENT ENDPOINTS =============

@api_router.post("/properties/{property_id}/hoa-charges", response_model=HOACharge)
async def create_hoa_charge(
    property_id: str,
    charge_data: HOAChargeCreate,
    user_id: str = Depends(get_current_user)
):
    """Create HOA maintenance charge (admin/owner only)"""
    # For MVP, allowing property owner to create charges
    # In production, this would be restricted to HOA admin role
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=403, detail="Only property owner can create charges")
    
    charge = HOACharge(
        created_by=user_id,
        **charge_data.dict()
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
    # Verify user has access
    has_access = await db.property_memberships.find_one({
        "property_id": property_id,
        "user_id": user_id
    })
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    
    if not has_access and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
    charge_id: str,
    origin_url: str,
    user_id: str = Depends(get_current_user)
):
    """Create Stripe checkout session for HOA charge payment"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    # Get charge details
    charge = await db.hoa_charges.find_one({"id": charge_id})
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")
    
    if charge['status'] == 'paid':
        raise HTTPException(status_code=400, detail="Charge already paid")
    
    # Verify user has access to this property
    property_id = charge['property_id']
    has_access = await db.property_memberships.find_one({
        "property_id": property_id,
        "user_id": user_id
    })
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    
    if not has_access and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Initialize Stripe
    stripe_api_key = os.environ.get('STRIPE_API_KEY')
    webhook_url = f"{origin_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    # Build success and cancel URLs
    success_url = f"{origin_url}/payment-success?session_id={{{{CHECKOUT_SESSION_ID}}}}"
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
    # Verify user has access to property
    has_access = await db.property_memberships.find_one({
        "property_id": property_id,
        "user_id": user_id
    })
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    
    if not has_access and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Generate approval code
    approval_code = str(uuid.uuid4())[:8].upper()
    
    visitor = Visitor(
        host_user_id=user_id,
        approval_code=approval_code,
        **visitor_data.dict()
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
    # Verify access
    has_access = await db.property_memberships.find_one({
        "property_id": property_id,
        "user_id": user_id
    })
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    
    if not has_access and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {"property_id": property_id}
    
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
    
    # For MVP, allowing any property member to approve
    # In production, restrict to admin/security role
    
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
async def create_community_post(
    property_id: str,
    post_data: CommunityPostCreate,
    user_id: str = Depends(get_current_user)
):
    """Create a community board post"""
    # Verify user has access to property
    has_access = await db.property_memberships.find_one({
        "property_id": property_id,
        "user_id": user_id
    })
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    
    if not has_access and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get user info
    user = await db.users.find_one({"id": user_id})
    user_name = user.get('username', 'Unknown') if user else 'Unknown'
    
    # Check if property owner
    is_admin = property_doc is not None  # Property owner is admin
    
    # Get user role from property membership
    user_role = None
    membership = await db.property_memberships.find_one({
        "property_id": property_id,
        "user_id": user_id
    })
    if membership:
        user_role = membership.get('role')  # "owner", "tenant", "resident"
    elif is_admin:
        user_role = "owner"  # Property owner is always owner
    
    post = CommunityPost(
        user_id=user_id,
        user_name=user_name,
        user_role=user_role,
        is_admin_post=is_admin,
        **post_data.dict()
    )
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
    # Verify access
    has_access = await db.property_memberships.find_one({
        "property_id": property_id,
        "user_id": user_id
    })
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    
    if not has_access and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {"property_id": property_id}
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
    """Get a specific post"""
    post = await db.community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Verify user has access to the property
    property_id = post['property_id']
    has_access = await db.property_memberships.find_one({
        "property_id": property_id,
        "user_id": user_id
    })
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    
    if not has_access and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if '_id' in post:
        post['_id'] = str(post['_id'])
    
    return post

@api_router.put("/community/posts/{post_id}")
async def update_post(
    post_id: str,
    post_data: CommunityPostUpdate,
    user_id: str = Depends(get_current_user)
):
    """Update a post (author or admin only)"""
    post = await db.community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Verify user is author or property owner
    property_doc = await db.properties.find_one({
        "id": post['property_id'],
        "user_id": user_id
    })
    
    if post['user_id'] != user_id and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {k: v for k, v in post_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.community_posts.update_one(
        {"id": post_id},
        {"$set": update_data}
    )
    
    return {"message": "Post updated"}

@api_router.delete("/community/posts/{post_id}")
async def delete_post(post_id: str, user_id: str = Depends(get_current_user)):
    """Delete a post (author or admin only)"""
    post = await db.community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Verify user is author or property owner
    property_doc = await db.properties.find_one({
        "id": post['property_id'],
        "user_id": user_id
    })
    
    if post['user_id'] != user_id and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete post and all comments
    await db.community_posts.delete_one({"id": post_id})
    await db.community_comments.delete_many({"post_id": post_id})
    await db.post_likes.delete_many({"post_id": post_id})
    
    return {"message": "Post deleted"}

@api_router.post("/community/posts/{post_id}/comments", response_model=CommunityComment)
async def create_comment(
    post_id: str,
    comment_data: CommunityCommentCreate,
    user_id: str = Depends(get_current_user)
):
    """Add a comment to a post"""
    # Verify post exists and user has access
    post = await db.community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    property_id = post['property_id']
    has_access = await db.property_memberships.find_one({
        "property_id": property_id,
        "user_id": user_id
    })
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    
    if not has_access and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get user info
    user = await db.users.find_one({"id": user_id})
    user_name = user.get('username', 'Unknown') if user else 'Unknown'
    
    comment = CommunityComment(
        user_id=user_id,
        user_name=user_name,
        **comment_data.dict()
    )
    await db.community_comments.insert_one(comment.dict())
    
    # Increment comment count
    await db.community_posts.update_one(
        {"id": post_id},
        {"$inc": {"comments_count": 1}}
    )
    
    return comment

@api_router.get("/community/posts/{post_id}/comments")
async def get_comments(post_id: str, user_id: str = Depends(get_current_user)):
    """Get all comments for a post"""
    # Verify post exists and user has access
    post = await db.community_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    property_id = post['property_id']
    has_access = await db.property_memberships.find_one({
        "property_id": property_id,
        "user_id": user_id
    })
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    
    if not has_access and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
    comments = await db.community_comments.find({"post_id": post_id}).sort("created_at", 1).to_list(length=1000)
    
    for c in comments:
        if '_id' in c:
            c['_id'] = str(c['_id'])
    
    return comments

@api_router.post("/community/posts/{post_id}/like")
async def toggle_post_like(post_id: str, user_id: str = Depends(get_current_user)):
    """Like or unlike a post"""
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
    # Check if user is property owner or HOA admin managing this property
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=403, detail="User not found")
    
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    is_managed = user.get("managed_properties") and property_id in user.get("managed_properties", [])
    
    if not property_doc and not is_managed:
        raise HTTPException(status_code=403, detail="Only property owner or HOA admin can create amenities")
    
    amenity = Amenity(**amenity_data.dict())
    await db.amenities.insert_one(amenity.dict())
    return amenity

@api_router.get("/properties/{property_id}/amenities")
async def get_amenities(property_id: str, user_id: str = Depends(get_current_user)):
    """Get all amenities for a property"""
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
    user = await db.users.find_one({"id": user_id})
    user_name = user.get('username', 'Unknown') if user else 'Unknown'
    
    complaint = Complaint(
        user_id=user_id,
        user_name=user_name,
        **complaint_data.dict()
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
    
    # Remove property_id from document_data if it exists to avoid duplication
    doc_dict = document_data.dict()
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
    query = {"property_id": property_id}
    if category:
        query["category"] = category
    
    documents = await db.documents.find(query).sort("upload_date", -1).to_list(length=1000)
    for d in documents:
        if '_id' in d:
            d['_id'] = str(d['_id'])
    return documents

@api_router.delete("/documents/{document_id}")
async def delete_document_simple(document_id: str, user_id: str = Depends(get_current_user)):
    """Delete a document (uploader or admin only) - Legacy endpoint"""
    document = await db.documents.find_one({"id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if user is uploader or property owner
    property_doc = await db.properties.find_one({"id": document['property_id'], "user_id": user_id})
    if document['uploaded_by'] != user_id and not property_doc:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.documents.delete_one({"id": document_id})
    return {"message": "Document deleted successfully"}

# ============= MEETING SCHEDULER ENDPOINTS =============

@api_router.post("/properties/{property_id}/meetings", response_model=Meeting)
async def create_meeting(
    property_id: str,
    meeting_data: MeetingCreate,
    user_id: str = Depends(get_current_user)
):
    """Create a meeting (admin/committee)"""
    # Check if user is property owner or HOA admin managing this property
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=403, detail="User not found")
    
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    is_managed = user.get("managed_properties") and property_id in user.get("managed_properties", [])
    
    if not property_doc and not is_managed:
        raise HTTPException(status_code=403, detail="Only property owner or HOA admin can create meetings")
    
    user_name = user.get('username', 'Unknown')
    
    meeting = Meeting(
        organizer_id=user_id,
        organizer_name=user_name,
        **meeting_data.dict()
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
    rsvps = await db.meeting_rsvps.find({"meeting_id": meeting_id}).to_list(length=1000)
    for r in rsvps:
        if '_id' in r:
            r['_id'] = str(r['_id'])
    return rsvps



# ============= ADMIN ENDPOINTS =============

# Helper function to check if user is super admin
async def verify_super_admin(user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user_id

# Helper function to check if user is HOA admin for a property
async def verify_hoa_admin(property_id: str, user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Super admins can access everything
    if user.get("is_super_admin"):
        return True
    
    # Check if user is HOA admin for this property
    if not user.get("is_hoa_admin"):
        raise HTTPException(status_code=403, detail="HOA admin access required")
    
    admin_assignment = await db.property_admin_assignments.find_one({
        "admin_user_id": user_id,
        "property_id": property_id
    })
    
    if not admin_assignment:
        raise HTTPException(status_code=403, detail="Not authorized for this property")
    
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
async def get_all_properties(super_admin_id: str = Depends(verify_super_admin)):
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
    
    result = []
    for admin in admins:
        assignments = await db.property_admin_assignments.find({"admin_user_id": admin["id"]}).to_list(length=100)
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
    payments_received = await db.payments.count_documents({
        "charge_id": {"$exists": True},
        "status": "paid"
    })
    
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
async def approve_or_reject_user(
    property_id: str,
    action: ApprovalAction,
    user_id: str = Depends(get_current_user)
):
    """Approve or reject a user approval request"""
    await verify_hoa_admin(property_id, user_id)
    
    # Get the approval request
    approval = await db.pending_user_approvals.find_one({"id": action.approval_id})
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    
    if approval["status"] != "pending":
        raise HTTPException(status_code=400, detail="Approval already processed")
    
    # Update approval status
    await db.pending_user_approvals.update_one(
        {"id": action.approval_id},
        {
            "$set": {
                "status": action.action,  # "approve" or "reject"
                "admin_notes": action.admin_notes,
                "reviewed_at": datetime.utcnow(),
                "reviewed_by": user_id
            }
        }
    )
    
    if action.action == "approve":
        # Create property membership
        membership = PropertyMembership(
            user_id=approval["user_id"],
            property_id=property_id,
            role=approval["requested_role"],
            status="active"
        )
        await db.property_memberships.insert_one(membership.dict())
        
        # Mark user as approved (can now login)
        await db.users.update_one(
            {"id": approval["user_id"]},
            {"$set": {"account_approved": True}}
        )
        
        message = "User approved successfully"
    else:
        message = "User rejected"
    
    return {"message": message}

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
        "property_id": property_id
    })
    
    if not membership:
        raise HTTPException(status_code=404, detail="User not a member of this property")
    
    # Create payment request
    charge = HOACharge(
        property_id=property_id,
        user_id=target_user_id,
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
    await verify_hoa_admin(property_id, user_id)
    
    # Get admin info
    admin = await db.users.find_one({"id": user_id})
    
    post_data = post.dict()
    post_data.pop('property_id', None)  # Remove property_id from post data to avoid duplicate
    
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
async def request_property_approval(
    request: ApprovalRequest,
    user_id: str = Depends(get_current_user)
):
    """User submits approval request with documents to join a property"""
    
    # Get user info
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get property info
    property_doc = await db.properties.find_one({"id": request.property_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Check if already submitted
    existing = await db.pending_user_approvals.find_one({
        "user_id": user_id,
        "property_id": request.property_id,
        "status": "pending"
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Approval request already pending")
    
    # Create approval request
    approval = PendingUserApproval(
        user_id=user_id,
        username=user["username"],
        email=user.get("email", ""),
        property_id=request.property_id,
        property_name=property_doc["name"],
        requested_role=request.requested_role,
        documents=request.documents,
        document_names=request.document_names,
        status="pending"
    )
    
    await db.pending_user_approvals.insert_one(approval.dict())
    
    # Mark user as pending approval (block login)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"account_approved": False}}
    )
    
    # TODO: Send notification to property admin
    
    return {"message": "Approval request submitted successfully", "approval_id": approval.id}

@api_router.get("/user/approval-status/{property_id}")
async def get_approval_status(
    property_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get user's approval status for a property"""
    
    approval = await db.pending_user_approvals.find_one({
        "user_id": user_id,
        "property_id": property_id
    }, sort=[("created_at", -1)])
    
    if not approval:
        return {"status": "not_submitted"}
    
    if '_id' in approval:
        approval['_id'] = str(approval['_id'])
    
    return approval


app.include_router(api_router)

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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
