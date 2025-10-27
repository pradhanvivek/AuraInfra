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
    created_at: datetime

class UserProfileUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    warranty_reminder_days: Optional[int] = None

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
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    unit: str = "feet"  # feet, meters
    floor_plan_image: Optional[str] = None  # base64 encoded
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MeasurementCreate(BaseModel):
    room_type: str
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    unit: str = "feet"
    floor_plan_image: Optional[str] = None
    notes: Optional[str] = None

class FloorPlanAnalysis(BaseModel):
    floor_plan_image: str  # base64 encoded

class VastuAnalysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    property_id: str
    floor_plan_image: str  # base64 encoded
    analysis_text: str
    compliance_score: Optional[int] = None  # 0-100
    recommendations: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VastuAnalysisCreate(BaseModel):
    floor_plan_image: str  # base64 encoded

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
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        # Get API key
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Initialize LLM chat with vision model for Vastu analysis
        chat = LlmChat(
            api_key=api_key,
            session_id=f"vastu_{user_id}_{uuid.uuid4()}",
            system_message="You are an expert in Vastu Shastra, the ancient Indian science of architecture and spatial design. Analyze floor plans for Vastu compliance and provide detailed recommendations."
        ).with_model("openai", "gpt-4o")
        
        # Create message with image
        user_message = UserMessage(
            text="""Analyze this floor plan according to Vastu Shastra principles. Please provide:

1. **Overall Vastu Compliance Score** (0-100): Rate the overall adherence to Vastu principles
2. **Direction Analysis**: Analyze the placement of rooms based on cardinal directions
   - Main entrance direction and its significance
   - Master bedroom placement (ideally South-West)
   - Kitchen placement (ideally South-East)
   - Pooja/Prayer room (ideally North-East)
   - Bathrooms and toilets placement
   - Living room placement (ideally North or East)

3. **Key Observations**:
   - Positive aspects that align with Vastu
   - Areas of concern or non-compliance
   - Energy flow assessment

4. **Detailed Recommendations**:
   - Specific corrections or remedies
   - Color recommendations for different rooms
   - Placement of furniture and fixtures
   - Remedial measures for any Vastu defects

5. **Priority Actions**: List 3-5 most important changes in order of priority

Please be specific and practical in your recommendations.""",
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
            recommendations=analysis_response
        )
        
        await db.vastu_analysis.insert_one(vastu_obj.dict())
        return vastu_obj
        
    except Exception as e:
        logger.error(f"Error analyzing Vastu: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing Vastu: {str(e)}")

@api_router.get("/properties/{property_id}/vastu", response_model=List[VastuAnalysis])
async def get_vastu_analyses(property_id: str, user_id: str = Depends(get_current_user)):
    # Verify property ownership
    property_doc = await db.properties.find_one({"id": property_id, "user_id": user_id})
    if not property_doc:
        raise HTTPException(status_code=404, detail="Property not found")
    
    analyses = await db.vastu_analysis.find({"property_id": property_id}).to_list(1000)
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
    
    if measurements:
        measurement_doc = measurements[0]
        measured_rooms = 0
        
        for room in ["master_bedroom", "living_area", "kitchen", "bathroom", "dining_area"]:
            if measurement_doc.get(room):
                measured_rooms += 1
        
        scores["measurements"] = (measured_rooms / expected_rooms) * 100
        
        if measured_rooms < expected_rooms:
            recommendations.append({
                "category": "measurements",
                "message": f"Add measurements for {expected_rooms - measured_rooms} more room(s)",
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
                "measured_rooms": len([m for m in measurements[0].keys() if m in ["master_bedroom", "living_area", "kitchen", "bathroom", "dining_area"]]) if measurements else 0,
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
