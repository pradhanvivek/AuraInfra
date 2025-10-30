from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
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
db = client[os.environ.get('DB_NAME', 'test_database')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'property_manager_secret_key_2025')
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
    warranty_reminder_days: int = 30
    geomancy_preference: str = "vastu"  # "vastu" or "feng_shui"
    currency_preference: Optional[str] = None  # "USD", "INR", "EUR", etc.
    measurement_system: Optional[str] = None  # "imperial" or "metric"
    created_at: datetime

class UserProfileUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    warranty_reminder_days: Optional[int] = None
    geomancy_preference: Optional[str] = None  # "vastu" or "feng_shui"
    currency_preference: Optional[str] = None  # "USD", "INR", "EUR", etc.
    measurement_system: Optional[str] = None  # "imperial" or "metric"

class Property(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PropertyCreate(BaseModel):
    name: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    name: str
    file_data: str  # base64 encoded file
    file_type: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class DocumentCreate(BaseModel):
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

class JewelryScanResult(BaseModel):
    name: str
    type: Optional[str] = None  # e.g., "ring", "necklace", "bracelet"
    metal_type: Optional[str] = None  # e.g., "gold", "silver", "platinum"
    gemstone_details: Optional[str] = None  # e.g., "diamond", "ruby"
    weight_estimate: Optional[str] = None  # estimated weight in grams
    estimated_value: Optional[str] = None
    confidence: float

# Receipt Scanner Models
class ReceiptScanRequest(BaseModel):
    image: str  # base64 encoded receipt image

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

# AI Scan Results
class VehicleScanResult(BaseModel):
    make: str
    model: str
    year: Optional[int] = None
    confidence: float

class JewelryScanResult(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = "Unknown"
    metal: Optional[str] = None
    stones: Optional[str] = None
    weight: Optional[float] = None
    estimated_value: Optional[float] = None
    confidence: float

# Portfolio Summary
class PortfolioSummary(BaseModel):
    total_value: float
    properties_value: float
    vehicles_value: float
    appliances_value: float
    jewelry_value: float
    properties_count: int
    vehicles_count: int
    appliances_count: int
    jewelry_count: int

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
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
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
    # Check if user exists
    existing_user = await db.users.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": user.username,
        "password": hashed_password.decode('utf-8'),
        "email": None,
        "phone": None,
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
    # Find user
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
    
    return UserProfile(
        id=user_doc["id"],
        username=user_doc["username"],
        email=user_doc.get("email"),
        phone=user_doc.get("phone"),
        warranty_reminder_days=user_doc.get("warranty_reminder_days", 30),
        geomancy_preference=user_doc.get("geomancy_preference", "vastu"),
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
    if profile.warranty_reminder_days is not None:
        if profile.warranty_reminder_days not in [7, 14, 30]:
            raise HTTPException(status_code=400, detail="warranty_reminder_days must be 7, 14, or 30")
        update_data["warranty_reminder_days"] = profile.warranty_reminder_days
    if profile.geomancy_preference is not None:
        if profile.geomancy_preference not in ["vastu", "feng_shui"]:
            raise HTTPException(status_code=400, detail="geomancy_preference must be 'vastu' or 'feng_shui'")
        update_data["geomancy_preference"] = profile.geomancy_preference
    
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
        warranty_reminder_days=user_doc.get("warranty_reminder_days", 30),
        created_at=user_doc["created_at"]
    )

# ============= PROPERTY ENDPOINTS =============

@api_router.post("/properties", response_model=Property)
async def create_property(property_data: PropertyCreate, user_id: str = Depends(get_current_user)):
    property_obj = Property(
        name=property_data.name,
        address=property_data.address,
        latitude=property_data.latitude,
        longitude=property_data.longitude,
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

@api_router.post("/properties/{property_id}/documents", response_model=Document)
async def create_document(
    property_id: str,
    document: DocumentCreate,
    user_id: str = Depends(get_current_user)
):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    doc_obj = Document(
        property_id=property_id,
        name=document.name,
        file_data=document.file_data,
        file_type=document.file_type
    )
    await db.documents.insert_one(doc_obj.dict())
    return doc_obj

@api_router.get("/properties/{property_id}/documents", response_model=List[Document])
async def get_documents(property_id: str, user_id: str = Depends(get_current_user)):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    documents = await db.documents.find({"property_id": property_id}).to_list(1000)
    return [Document(**doc) for doc in documents]

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
    
    result = await db.documents.delete_one({"id": document_id, "property_id": property_id})
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
        # Get properties
        properties_cursor = db.properties.find({"user_id": user_id})
        properties = await properties_cursor.to_list(length=1000)
        properties_value = sum(float(p.get('price', 0)) for p in properties)
        
        # Get vehicles
        vehicles_cursor = db.vehicles.find({"user_id": user_id})
        vehicles = await vehicles_cursor.to_list(length=1000)
        vehicles_value = sum(float(v.get('current_value', 0) or 0) for v in vehicles)
        
        # Get appliances
        appliances_cursor = db.appliances.find({"user_id": user_id})
        appliances = await appliances_cursor.to_list(length=1000)
        appliances_value = sum(float(a.get('current_value', 0) or 0) for a in appliances)
        
        # Get jewelry
        jewelry_cursor = db.jewelry.find({"user_id": user_id})
        jewelry = await jewelry_cursor.to_list(length=1000)
        jewelry_value = sum(float(j.get('appraisal_value', 0) or 0) for j in jewelry)
        
        return PortfolioSummary(
            total_value=properties_value + vehicles_value + appliances_value + jewelry_value,
            properties_value=properties_value,
            vehicles_value=vehicles_value,
            appliances_value=appliances_value,
            jewelry_value=jewelry_value,
            properties_count=len(properties),
            vehicles_count=len(vehicles),
            appliances_count=len(appliances),
            jewelry_count=len(jewelry)
        )
    except Exception as e:
        logger.error(f"Portfolio summary error: {str(e)}")
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
async def scan_vehicle(scan_data: dict, user_id: str = Depends(get_current_user)):
    """AI scan for vehicle identification"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"vehicle_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert in identifying vehicles from images."
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(
            text="""Analyze this vehicle image and identify it.

Return ONLY a valid JSON object:
{
  "make": "BMW",
  "model": "3 Series",
  "year": 2020,
  "confidence": 0.95
}

If year is not clear, set it to null. Return ONLY JSON, no additional text.""",
            file_contents=[ImageContent(image_base64=scan_data['image'])]
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
async def scan_jewelry(scan_data: dict, user_id: str = Depends(get_current_user)):
    """AI scan for jewelry identification"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
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
            file_contents=[ImageContent(image_base64=scan_data['image'])]
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

# ============= APPLIANCE SCANNER ENDPOINT =============

@api_router.post("/fixtures/scan-appliance", response_model=ApplianceScanResult)
async def scan_appliance(
    scan_request: ApplianceScanRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Use Gemini Vision AI to identify appliance from image
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"appliance_scan_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert in identifying home appliances and electrical fixtures."
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(
            text="""Analyze this image and identify the appliance or electrical fixture. 
            
Return ONLY a valid JSON object with this structure:
{
  "name": "Specific name (e.g., 'Ceiling Fan', 'LED TV', 'Refrigerator')",
  "category": "Category (lights, fans, electrical appliances)",
  "make": "Brand name if visible (e.g., 'Samsung', 'LG', 'Crompton')",
  "model": "Model number if visible",
  "serial_number": "Serial number if visible",
  "confidence": 0.95
}

If you can't identify the item clearly, set confidence lower. 
Return ONLY the JSON object, no additional text.""",
            file_contents=[ImageContent(image_base64=scan_request.image)]
        )
        
        response = await chat.send_message(user_message)
        logger.info(f"Appliance scan response: {response}")
        
        # Parse JSON response
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
            else:
                result = json.loads(response)
            
            return ApplianceScanResult(**result)
            
        except json.JSONDecodeError as je:
            logger.error(f"JSON parsing error: {str(je)}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Appliance scan error: {str(e)}")
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


app.include_router(api_router)

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
