from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Annotated
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Vybe API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─── Helpers ────────────────────────────────────────────────────────────────

def new_id() -> str:
    return str(uuid.uuid4())

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def clean(doc: dict) -> dict:
    """Remove MongoDB _id from response dict."""
    if doc:
        doc.pop('_id', None)
    return doc


# ─── Seed Data ───────────────────────────────────────────────────────────────

UK_EVENTS = [
    # Newcastle
    {
        "id": "evt_hoppings_2026",
        "name": "The Hoppings Funfair",
        "description": "Europe's largest travelling fair returns to Newcastle's Town Moor. Over 400 rides, stalls and attractions for the whole family — from white-knuckle thrill rides to traditional candy floss and hook-a-duck.",
        "city": "Newcastle",
        "venue": "Town Moor",
        "address": "Town Moor, Newcastle upon Tyne, NE3 4YP",
        "lat": 54.9895, "lng": -1.6180,
        "date": "2026-06-13", "endDate": "2026-06-22", "time": "12:00",
        "category": "Family",
        "price": 0, "priceLabel": "Free entry (rides from £2)",
        "imageUrl": "https://images.unsplash.com/photo-1466027397211-20d0f2449a3d?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": True,
        "ageSuitability": "All Ages", "isOutdoor": True,
        "ticketUrl": None, "ticketProvider": None,
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 12000, "averageRating": 4.6, "reviewCount": 342,
        "food": {
            "onSite": ["Candy Floss Stall", "Hot Dog Vans", "Donut Station", "Fish & Chips", "Crepes & Waffles"],
            "nearby": ["Café Royal Newcastle (0.8mi)", "Fat Hippo Burger (1.2mi)", "Turtle Bay (1.5mi)"]
        },
        "parking": {
            "carParks": ["Town Moor Event Parking (free)", "Barrack Road Car Park (£3/day)", "Leazes Park Road (£2.50/day)"],
            "publicTransport": ["Bus: Routes 33, 35, 36 stop at Great North Road", "Metro: Regent Centre then 10 min walk"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": False, "quietSpaces": True,
            "bsl": False, "assistance": True,
            "details": "Paved pathways throughout. Accessible toilets on site. Carer admission free."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Height restrictions on certain rides (marked clearly at each ride)",
            "sections": ["Toddler Zone (0-5)", "Family Rides (All Ages)", "Thrill Rides (must be 1.2m+)", "Traditional Fairground (All Ages)"]
        },
        "tags": ["fairground", "family", "rides", "outdoor", "summer"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    {
        "id": "evt_sage_summer_2026",
        "name": "Sage Gateshead: Summer Sessions",
        "description": "World-class music performances in a stunning riverside venue. This summer's sessions feature jazz, classical, and indie artists from across the UK and Europe.",
        "city": "Newcastle",
        "venue": "Sage Gateshead",
        "address": "St Mary's Square, Gateshead Quays, NE8 2JR",
        "lat": 54.9680, "lng": -1.6015,
        "date": "2026-07-05", "endDate": "2026-07-05", "time": "19:30",
        "category": "Music",
        "price": 25, "priceLabel": "From £25",
        "imageUrl": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
        "isVerified": True, "isTrending": False, "isFeatured": False,
        "ageSuitability": "All Ages", "isOutdoor": False,
        "ticketUrl": "https://www.ticketmaster.co.uk", "ticketProvider": "Ticketmaster",
        "isSoldOut": False, "isLimitedSpaces": True,
        "attendeeCount": 1750, "averageRating": 4.8, "reviewCount": 89,
        "food": {
            "onSite": ["Sage Brasserie (pre-show dining)", "Bar & Nibbles Lounge", "Riverside Terrace Bar"],
            "nearby": ["Café 21 (0.2mi)", "Quayside Restaurants (0.4mi)"]
        },
        "parking": {
            "carParks": ["Gateshead Quays NCP (£8 eve)", "Baltic Car Park (£6 eve)"],
            "publicTransport": ["Metro: Gateshead (5 min walk)", "Bus: Yellow Line to Gateshead town centre"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": True, "quietSpaces": True,
            "bsl": True, "assistance": True,
            "details": "Full wheelchair access. BSL-interpreted performances available on selected dates. Hearing loops in all halls."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Under 16s must be accompanied by an adult",
            "sections": ["Main Hall performances", "Bar events (18+)"]
        },
        "tags": ["music", "jazz", "classical", "indoor", "riverside"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    # London
    {
        "id": "evt_carnival_2026",
        "name": "Notting Hill Carnival",
        "description": "Europe's biggest street festival! Two days of vibrant Caribbean culture, mas bands, spectacular costumes, sound systems, and incredible jerk chicken. An unmissable London summer tradition.",
        "city": "London",
        "venue": "Notting Hill Streets",
        "address": "Ladbroke Grove, Notting Hill, London W11",
        "lat": 51.5152, "lng": -0.2061,
        "date": "2026-08-23", "endDate": "2026-08-24", "time": "10:00",
        "category": "Family",
        "price": 0, "priceLabel": "Free",
        "imageUrl": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": True,
        "ageSuitability": "All Ages", "isOutdoor": True,
        "ticketUrl": None, "ticketProvider": None,
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 150000, "averageRating": 4.7, "reviewCount": 1204,
        "food": {
            "onSite": ["Jerk Chicken Stalls", "Caribbean Rice & Peas", "Roti Wraps", "Coconut Water Vendors", "Rum Punch Bars"],
            "nearby": ["Granger & Co Notting Hill (0.5mi)", "The Ledbury (0.6mi)"]
        },
        "parking": {
            "carParks": ["Do not drive — most roads closed for the carnival"],
            "publicTransport": ["Tube: Ladbroke Grove (Circle/Hammersmith Lines)", "Tube: Notting Hill Gate (Central Line)"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": False, "quietSpaces": False,
            "bsl": False, "assistance": False,
            "details": "Large crowds may make navigation difficult. Viewing areas with good access near Hyde Park side. Early arrival recommended."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Under 12s should avoid peak times (12pm-6pm) due to crowd density",
            "sections": ["Children's Day (Sunday — quieter)", "Main Carnival Day (Monday — largest crowds)"]
        },
        "tags": ["carnival", "caribbean", "street festival", "music", "food"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    {
        "id": "evt_borough_2026",
        "name": "Borough Market Food Festival",
        "description": "Celebrate London's most iconic food market with a special spring food festival. Over 100 artisan producers, live cooking demos from Michelin-star chefs, and tasting sessions.",
        "city": "London",
        "venue": "Borough Market",
        "address": "8 Southwark St, London SE1 1TL",
        "lat": 51.5055, "lng": -0.0910,
        "date": "2026-04-12", "endDate": "2026-04-12", "time": "09:00",
        "category": "Food",
        "price": 0, "priceLabel": "Free entry",
        "imageUrl": "https://images.unsplash.com/photo-1551883709-2516220df0bc?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": False,
        "ageSuitability": "All Ages", "isOutdoor": False,
        "ticketUrl": None, "ticketProvider": None,
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 8000, "averageRating": 4.9, "reviewCount": 567,
        "food": {
            "onSite": ["Street Food Traders", "Artisan Bakeries", "Cheese Specialists", "Wine & Craft Beer", "Global Cuisine Stalls"],
            "nearby": ["Arabica Bar & Kitchen (adj)", "Casse-Croûte (0.3mi)"]
        },
        "parking": {
            "carParks": ["Southwark Street NCP (£15 day)", "London Bridge Car Park (£12 day)"],
            "publicTransport": ["Tube/Rail: London Bridge (3 min walk)", "Tube: Borough (5 min walk)"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": False, "quietSpaces": False,
            "bsl": False, "assistance": True,
            "details": "Fully accessible indoor market. Wide aisles. Priority queuing available for mobility-impaired visitors."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "No age restrictions. Children welcome.",
            "sections": ["Market Hall", "Tasting Area", "Demo Kitchen"]
        },
        "tags": ["food", "market", "artisan", "cooking", "tasting"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    # Manchester
    {
        "id": "evt_mcr_food_2026",
        "name": "Manchester Food & Drink Festival",
        "description": "The North's premier celebration of food and drink. Over 2 weeks of special menus, tastings, markets, and events across Manchester's thriving restaurant scene.",
        "city": "Manchester",
        "venue": "First Street & Venues Across Manchester",
        "address": "First Street, Manchester M15 4FN",
        "lat": 53.4731, "lng": -2.2482,
        "date": "2026-10-03", "endDate": "2026-10-11", "time": "11:00",
        "category": "Food",
        "price": 0, "priceLabel": "Free (some events ticketed)",
        "imageUrl": "https://images.unsplash.com/photo-1551883709-2516220df0bc?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": True,
        "ageSuitability": "All Ages", "isOutdoor": True,
        "ticketUrl": "https://www.eventbrite.co.uk", "ticketProvider": "Eventbrite",
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 25000, "averageRating": 4.7, "reviewCount": 421,
        "food": {
            "onSite": ["Manchester Street Food Market", "Craft Beer Village", "Wine Masterclasses", "Chef Demo Stage"],
            "nearby": ["Mana Restaurant (0.4mi)", "Elnecot (0.6mi)", "Bundobust (0.8mi)"]
        },
        "parking": {
            "carParks": ["First Street Multi-Storey (£5/day)", "Deansgate Car Park (£6 day)"],
            "publicTransport": ["Metrolink: Deansgate-Castlefield (5 min walk)", "Train: Oxford Road (8 min walk)"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": False, "quietSpaces": True,
            "bsl": False, "assistance": True,
            "details": "All main festival areas are level access. Accessible toilets throughout the site."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Alcohol tasting events are strictly 18+",
            "sections": ["Family Food Zone (All Ages)", "Adults Bar Trail (18+)", "Chef Demo Stage (All Ages)"]
        },
        "tags": ["food", "drink", "festival", "restaurants", "market"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    {
        "id": "evt_mcr_jazz_2026",
        "name": "Manchester Jazz Festival",
        "description": "World-class jazz in the heart of Manchester. Eleven days of free and ticketed performances in iconic venues across the city, from intimate clubs to the grand Bridgewater Hall.",
        "city": "Manchester",
        "venue": "Various Venues",
        "address": "Manchester City Centre, Manchester M2",
        "lat": 53.4784, "lng": -2.2453,
        "date": "2026-07-12", "endDate": "2026-07-22", "time": "18:00",
        "category": "Music",
        "price": 15, "priceLabel": "From £15",
        "imageUrl": "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&q=80",
        "isVerified": True, "isTrending": False, "isFeatured": False,
        "ageSuitability": "All Ages", "isOutdoor": False,
        "ticketUrl": "https://www.manchesterjazz.com", "ticketProvider": "Direct",
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 5000, "averageRating": 4.8, "reviewCount": 156,
        "food": {
            "onSite": ["Venue bars at each location"],
            "nearby": ["Albert's Chop House (0.3mi)", "Elnecot (0.5mi)", "Hawksmoor (0.4mi)"]
        },
        "parking": {
            "carParks": ["NCP Great Northern (£8 eve)", "Manchester Arndale Q-Park (£7 eve)"],
            "publicTransport": ["Metrolink: St Peter's Square (2 min walk)", "Metrolink: Market Street (4 min walk)"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": True, "quietSpaces": False,
            "bsl": False, "assistance": True,
            "details": "Venues vary — check individual listings. Bridgewater Hall fully accessible."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Some late-night bar events are 18+",
            "sections": ["Afternoon Free Performances (All Ages)", "Evening Concerts (All Ages)", "Late Night Club Shows (18+)"]
        },
        "tags": ["jazz", "music", "live", "concert", "classical"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    # Edinburgh
    {
        "id": "evt_fringe_2026",
        "name": "Edinburgh Festival Fringe",
        "description": "The world's largest arts festival! Over 3,000 shows across 300 venues — comedy, theatre, dance, circus, music and more. Something for absolutely everyone in the stunning city of Edinburgh.",
        "city": "Edinburgh",
        "venue": "Venues Across Edinburgh",
        "address": "Various, Edinburgh EH1",
        "lat": 55.9533, "lng": -3.1883,
        "date": "2026-08-01", "endDate": "2026-08-24", "time": "10:00",
        "category": "Arts",
        "price": 12, "priceLabel": "From £12",
        "imageUrl": "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": True,
        "ageSuitability": "All Ages", "isOutdoor": False,
        "ticketUrl": "https://www.edfringe.com", "ticketProvider": "Direct",
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 450000, "averageRating": 4.8, "reviewCount": 2341,
        "food": {
            "onSite": ["The Mound (outdoor food court)", "Grassmarket Market", "Venue bars throughout"],
            "nearby": ["The Witchery (0.3mi)", "Dishoom Edinburgh (0.5mi)", "The Dome (0.4mi)"]
        },
        "parking": {
            "carParks": ["St James Quarter (£18/day)", "Castle Terrace NCP (£12/day)"],
            "publicTransport": ["Tram: York Place (10 min walk)", "Bus: Numerous routes to Princes Street"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": True, "quietSpaces": True,
            "bsl": True, "assistance": True,
            "details": "Many Fringe venues are accessible. Check the Fringe app for venue-specific accessibility info. BSL shows available daily."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Age-restricted shows clearly labelled (16+, 18+)",
            "sections": ["Family Shows (All Ages)", "Children's Shows (U12)", "Comedy (16+ recommended)", "Late Night Adults (18+)"]
        },
        "tags": ["arts", "comedy", "theatre", "fringe", "festival"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    {
        "id": "evt_tattoo_2026",
        "name": "Royal Edinburgh Military Tattoo",
        "description": "A world-famous spectacle of military music, dance, and pageantry held on the esplanade of Edinburgh Castle. One of the most iconic events in the world.",
        "city": "Edinburgh",
        "venue": "Edinburgh Castle Esplanade",
        "address": "Edinburgh Castle, Castlehill, Edinburgh EH1 2NG",
        "lat": 55.9486, "lng": -3.1999,
        "date": "2026-08-05", "endDate": "2026-08-29", "time": "21:00",
        "category": "Arts",
        "price": 45, "priceLabel": "From £45",
        "imageUrl": "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": False,
        "ageSuitability": "All Ages", "isOutdoor": True,
        "ticketUrl": "https://www.edintattoo.co.uk", "ticketProvider": "Direct",
        "isSoldOut": False, "isLimitedSpaces": True,
        "attendeeCount": 8800, "averageRating": 4.9, "reviewCount": 876,
        "food": {
            "onSite": ["Tattoo Terrace Bar & Restaurant"],
            "nearby": ["The Witchery (adj)", "Amber Restaurant (0.2mi)", "Ensign Ewart (0.1mi)"]
        },
        "parking": {
            "carParks": ["Castle Terrace NCP (10 min walk)", "Lothian Road parking"],
            "publicTransport": ["Bus: Numerous routes to Royal Mile", "Tram: York Place (15 min walk)"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": True, "quietSpaces": False,
            "bsl": True, "assistance": True,
            "details": "Dedicated accessible seating area. Contact box office in advance. Audio description available."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Late show (10pm) ends near midnight — not recommended for very young children",
            "sections": ["Full 90-minute performance", "Accessible viewing area available"]
        },
        "tags": ["military", "tattoo", "castle", "spectacular", "scottish"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    # Birmingham
    {
        "id": "evt_brum_german_2026",
        "name": "Birmingham German Christmas Market",
        "description": "The largest authentic German Christmas market outside Germany and Austria! Over 180 wooden stalls selling traditional crafts, food, and mulled wine in the heart of Birmingham city centre.",
        "city": "Birmingham",
        "venue": "City Centre (Victoria Square & Centenary Square)",
        "address": "Victoria Square, Birmingham B1 1BB",
        "lat": 52.4807, "lng": -1.9040,
        "date": "2026-11-05", "endDate": "2026-12-23", "time": "10:00",
        "category": "Markets",
        "price": 0, "priceLabel": "Free entry",
        "imageUrl": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": True,
        "ageSuitability": "All Ages", "isOutdoor": True,
        "ticketUrl": None, "ticketProvider": None,
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 60000, "averageRating": 4.5, "reviewCount": 1876,
        "food": {
            "onSite": ["Bratwurst Stalls", "Glühwein (Mulled Wine)", "Stollen & Gingerbread", "Reibekuchen (Potato Cakes)", "Crepes & Hot Chocolate"],
            "nearby": ["Adam's Restaurant (0.3mi)", "Purnell's (0.4mi)", "Dishoom Birmingham (0.6mi)"]
        },
        "parking": {
            "carParks": ["NCP Broad Street (5 min walk)", "Brindleyplace Car Park (6 min walk)"],
            "publicTransport": ["Rail/Tram: Birmingham New Street (5 min walk)", "Tram: Grand Central stop"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": False, "quietSpaces": False,
            "bsl": False, "assistance": True,
            "details": "Market is on level paved streets. Crowd density can be very high at weekends — weekday mornings recommended for wheelchair users."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Alcohol stalls are 18+",
            "sections": ["Christmas Craft Stalls (All Ages)", "Food & Drink (All Ages)", "Festive Rides nearby (All Ages)"]
        },
        "tags": ["christmas", "market", "german", "festive", "shopping"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    {
        "id": "evt_digbeth_2026",
        "name": "Digbeth Dining Club",
        "description": "Birmingham's legendary street food market. Every week, top street food vendors, live music, and a buzzing atmosphere in the vibrant Digbeth neighbourhood.",
        "city": "Birmingham",
        "venue": "Digbeth Dining Club HQ",
        "address": "Gibb Street, Digbeth, Birmingham B9 4AA",
        "lat": 52.4771, "lng": -1.8890,
        "date": "2026-03-14", "endDate": "2026-03-14", "time": "17:00",
        "category": "Food",
        "price": 0, "priceLabel": "Free entry",
        "imageUrl": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
        "isVerified": True, "isTrending": False, "isFeatured": False,
        "ageSuitability": "All Ages", "isOutdoor": True,
        "ticketUrl": None, "ticketProvider": None,
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 2500, "averageRating": 4.6, "reviewCount": 234,
        "food": {
            "onSite": ["Rotating street food vendors (BBQ, Asian, Mexican, British)", "Craft Beer Bar", "Cocktail Bar"],
            "nearby": ["Original Patty Men (0.2mi)", "Warehouse Café (0.3mi)"]
        },
        "parking": {
            "carParks": ["Digbeth Coach Station Parking (0.3mi)", "On-street parking on Adderley St"],
            "publicTransport": ["Bus: 50/50A to Digbeth", "Rail: Birmingham Moor Street (15 min walk)"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": False, "quietSpaces": False,
            "bsl": False, "assistance": False,
            "details": "Outdoor event on level ground. Some areas may be uneven."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Bar area is 18+",
            "sections": ["Street Food Area (All Ages)", "Bar Zone (18+)"]
        },
        "tags": ["street food", "food", "market", "outdoor", "music"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    # Leeds
    {
        "id": "evt_leeds_festival_2026",
        "name": "Leeds Festival",
        "description": "One of the UK's most iconic music festivals. Three days of headline acts across multiple stages at Bramham Park. Rock, indie, pop, hip-hop and more. An unforgettable summer experience.",
        "city": "Leeds",
        "venue": "Bramham Park",
        "address": "Bramham Park, Boston Spa, Wetherby LS23 6ND",
        "lat": 53.8760, "lng": -1.3360,
        "date": "2026-08-21", "endDate": "2026-08-23", "time": "12:00",
        "category": "Music",
        "price": 285, "priceLabel": "From £285 (Weekend)",
        "imageUrl": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": True,
        "ageSuitability": "16+", "isOutdoor": True,
        "ticketUrl": "https://www.leedsfestival.com", "ticketProvider": "Festival Republic",
        "isSoldOut": False, "isLimitedSpaces": True,
        "attendeeCount": 80000, "averageRating": 4.6, "reviewCount": 3412,
        "food": {
            "onSite": ["Festival Food Village", "Vegan Quarter", "Pizza & Pasta Zone", "World Food Stalls", "Late Night Takeaways"],
            "nearby": ["Leeds city centre restaurants (8mi)"]
        },
        "parking": {
            "carParks": ["Official Festival Parking (pre-book)", "Car Share Zones"],
            "publicTransport": ["Shuttle buses from Leeds City Station", "National Express coaches from major cities"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": True, "quietSpaces": True,
            "bsl": False, "assistance": True,
            "details": "Dedicated accessible camping and viewing areas. Contact accessibility team in advance for full support."
        },
        "ageGuide": {
            "suitableFor": "16+",
            "restrictions": "Under 16s not admitted. 16-17 year olds must be accompanied by an adult aged 18+.",
            "sections": ["Main Stage", "Radio 1 Stage", "Festival Republic Stage", "Independent & Emerging Stage"]
        },
        "tags": ["music", "festival", "camping", "rock", "indie", "pop"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    # Liverpool
    {
        "id": "evt_sound_city_2026",
        "name": "Liverpool Sound City",
        "description": "The UK's leading urban music and technology festival. Discover emerging artists, attend music industry talks, and experience live performances across Liverpool's iconic Baltic Triangle.",
        "city": "Liverpool",
        "venue": "Baltic Triangle",
        "address": "Baltic Triangle, Liverpool L1 0BE",
        "lat": 53.3975, "lng": -2.9786,
        "date": "2026-05-01", "endDate": "2026-05-03", "time": "14:00",
        "category": "Music",
        "price": 35, "priceLabel": "From £35",
        "imageUrl": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": True,
        "ageSuitability": "18+", "isOutdoor": False,
        "ticketUrl": "https://www.liverpoolsoundcity.co.uk", "ticketProvider": "Direct",
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 7000, "averageRating": 4.7, "reviewCount": 678,
        "food": {
            "onSite": ["Baltic Market (adjacent)", "Bunker Food Trucks", "Pop-up Bars"],
            "nearby": ["The Baltic Market (0.1mi)", "Lerpwl (0.3mi)", "Maray (0.5mi)"]
        },
        "parking": {
            "carParks": ["Baltic Creative Car Park (£5 day)", "Camp & Furnace Parking (£4 day)"],
            "publicTransport": ["Bus: Routes 80, 82 to Parliament Street", "Rail: Liverpool Central (15 min walk)"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": False, "quietSpaces": True,
            "bsl": False, "assistance": True,
            "details": "Most venues are accessible. Check individual venue pages. Event is 18+ throughout."
        },
        "ageGuide": {
            "suitableFor": "18+",
            "restrictions": "Strictly 18+ — ID required",
            "sections": ["Emerging Artists Stage", "Main Stage", "Industry Talks", "Late Night Raves"]
        },
        "tags": ["music", "indie", "emerging artists", "technology", "festival"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    {
        "id": "evt_liverpool_river_2026",
        "name": "Liverpool River Festival",
        "description": "A spectacular free festival celebrating Liverpool's maritime heritage. Stunning tall ships, live music, street performers, and incredible views along the iconic waterfront.",
        "city": "Liverpool",
        "venue": "Liverpool Waterfront",
        "address": "Pier Head, Liverpool L3 1BY",
        "lat": 53.4058, "lng": -2.9920,
        "date": "2026-06-06", "endDate": "2026-06-07", "time": "10:00",
        "category": "Outdoors",
        "price": 0, "priceLabel": "Free",
        "imageUrl": "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=800&q=80",
        "isVerified": True, "isTrending": False, "isFeatured": False,
        "ageSuitability": "All Ages", "isOutdoor": True,
        "ticketUrl": None, "ticketProvider": None,
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 18000, "averageRating": 4.5, "reviewCount": 345,
        "food": {
            "onSite": ["Waterfront Food Village", "Pop-up Street Food", "Ice Cream Vendors"],
            "nearby": ["The Dock Kitchen (0.4mi)", "The Art School Restaurant (0.6mi)"]
        },
        "parking": {
            "carParks": ["Liver Street NCP (0.3mi)", "Albert Dock Car Park (0.4mi)"],
            "publicTransport": ["Bus: Routes 10, 10A, 10B to Pier Head", "Merseyrail: James Street (8 min walk)"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": False, "quietSpaces": False,
            "bsl": False, "assistance": True,
            "details": "Flat promenade along the waterfront. Fully accessible. Viewing areas for tall ships."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "No restrictions",
            "sections": ["Tall Ships Viewing (All Ages)", "Live Music Stage (All Ages)", "Kids Activities (U12)"]
        },
        "tags": ["waterfront", "ships", "maritime", "outdoor", "family"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    # Cardiff
    {
        "id": "evt_cardiff_food_2026",
        "name": "Cardiff Bay Food Festival",
        "description": "Wales's biggest food festival set against the stunning backdrop of Cardiff Bay. Over 150 producers, live cookery demonstrations, and a celebration of Welsh produce and world cuisine.",
        "city": "Cardiff",
        "venue": "Cardiff Bay",
        "address": "Roald Dahl Plass, Cardiff CF10 5AL",
        "lat": 51.4659, "lng": -3.1619,
        "date": "2026-08-28", "endDate": "2026-08-30", "time": "10:00",
        "category": "Food",
        "price": 0, "priceLabel": "Free",
        "imageUrl": "https://images.unsplash.com/photo-1551883709-2516220df0bc?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": True,
        "ageSuitability": "All Ages", "isOutdoor": True,
        "ticketUrl": None, "ticketProvider": None,
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 22000, "averageRating": 4.6, "reviewCount": 543,
        "food": {
            "onSite": ["Welsh Produce Market", "Seafood Station", "International Street Food", "Welsh Ales & Cider", "Dessert Heaven Zone"],
            "nearby": ["Asador 44 (0.8mi)", "The Potted Pig (1.0mi)"]
        },
        "parking": {
            "carParks": ["Red Dragon Centre (£5/day)", "Mermaid Quay Car Park (£6/day)"],
            "publicTransport": ["Bus: Routes X45, X46 to Cardiff Bay", "Rail: Cardiff Bay station (5 min walk)"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": False, "quietSpaces": False,
            "bsl": False, "assistance": True,
            "details": "Level paved waterfront. Fully accessible. Accessible toilets on site."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Alcohol tasting for 18+ only",
            "sections": ["Food Market (All Ages)", "Chef Stage (All Ages)", "Bar Village (18+)", "Kids Cooking Zone (U12)"]
        },
        "tags": ["food", "welsh", "bay", "market", "festival"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    # Bristol
    {
        "id": "evt_bristol_harbour_2026",
        "name": "Bristol Harbour Festival",
        "description": "One of the UK's biggest free festivals! Bristol's iconic harbourside comes alive with tall ships, live music across multiple stages, circus performances, and incredible local food and drink.",
        "city": "Bristol",
        "venue": "Bristol Harbourside",
        "address": "Harbourside, Bristol BS1 5UH",
        "lat": 51.4500, "lng": -2.5990,
        "date": "2026-07-17", "endDate": "2026-07-19", "time": "11:00",
        "category": "Outdoors",
        "price": 0, "priceLabel": "Free",
        "imageUrl": "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": True,
        "ageSuitability": "All Ages", "isOutdoor": True,
        "ticketUrl": None, "ticketProvider": None,
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 40000, "averageRating": 4.8, "reviewCount": 1123,
        "food": {
            "onSite": ["International Food Village", "Local Producers Market", "Vegan Street Food", "Craft Beer Tent", "Bristol Bakeries"],
            "nearby": ["Riverstation (0.3mi)", "Poco (0.5mi)", "Lido Bristol (0.7mi)"]
        },
        "parking": {
            "carParks": ["Trenchard Street NCP (£8/day)", "Cabot Circus Parking (£10/day)"],
            "publicTransport": ["Bus: Routes 8, 9 to Harbourside", "Cycling: Bristol cycle hire available at festival"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": True, "quietSpaces": True,
            "bsl": False, "assistance": True,
            "details": "Flat harbourside promenade. Accessible viewing areas at all stages. Free carer tickets available."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "No restrictions",
            "sections": ["Main Stage (All Ages)", "Acoustic Stage (All Ages)", "Kids Zone (U12)", "Arts & Craft Area (All Ages)"]
        },
        "tags": ["harbour", "festival", "ships", "music", "outdoor", "free"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    {
        "id": "evt_balloon_fiesta_2026",
        "name": "Bristol International Balloon Fiesta",
        "description": "Europe's largest hot air balloon festival! Watch hundreds of colourful balloons fill the Bristol sky. Night glows, mass ascents, and family entertainment in beautiful Ashton Court.",
        "city": "Bristol",
        "venue": "Ashton Court Estate",
        "address": "Ashton Court Estate, Long Ashton, Bristol BS41 9JN",
        "lat": 51.4393, "lng": -2.6370,
        "date": "2026-08-06", "endDate": "2026-08-09", "time": "06:00",
        "category": "Family",
        "price": 0, "priceLabel": "Free",
        "imageUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": False,
        "ageSuitability": "All Ages", "isOutdoor": True,
        "ticketUrl": None, "ticketProvider": None,
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 75000, "averageRating": 4.9, "reviewCount": 2100,
        "food": {
            "onSite": ["Festival Food Village", "Ice Cream Stalls", "BBQ Vendors", "Real Ale Bar"],
            "nearby": ["The Smyth Arms (0.5mi)", "Ashton Gate Restaurants (1.0mi)"]
        },
        "parking": {
            "carParks": ["Official event parking on site (pre-book)", "Park & Ride from Bristol city"],
            "publicTransport": ["Bus: Shuttle service from Temple Meads station", "Cycling: Cycle storage available"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": False, "quietSpaces": True,
            "bsl": False, "assistance": True,
            "details": "Large estate with grass areas. Accessible toilet facilities. Some uneven terrain."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Very early morning ascents (6am) may not suit young children",
            "sections": ["Mass Ascents (Dawn & Dusk)", "Night Glow (Evening)", "Fun Fair (All Ages)", "Tethered Balloon Rides (additional cost)"]
        },
        "tags": ["balloons", "family", "outdoor", "sky", "festival"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    # Glasgow
    {
        "id": "evt_glasgow_jazz_2026",
        "name": "Glasgow Jazz Festival",
        "description": "Ten days of world-class jazz in Scotland's most vibrant city. From traditional New Orleans jazz to cutting-edge contemporary sounds, this festival has it all.",
        "city": "Glasgow",
        "venue": "Various Glasgow Venues",
        "address": "City Centre, Glasgow G1 1DX",
        "lat": 55.8617, "lng": -4.2583,
        "date": "2026-06-19", "endDate": "2026-06-28", "time": "18:00",
        "category": "Music",
        "price": 15, "priceLabel": "From £15",
        "imageUrl": "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&q=80",
        "isVerified": True, "isTrending": True, "isFeatured": True,
        "ageSuitability": "All Ages", "isOutdoor": False,
        "ticketUrl": "https://www.jazzfest.co.uk", "ticketProvider": "Direct",
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 8000, "averageRating": 4.7, "reviewCount": 423,
        "food": {
            "onSite": ["Venue bars & restaurants"],
            "nearby": ["Ox and Finch (0.4mi)", "Ubiquitous Chip (0.6mi)", "Cail Bruich (0.8mi)"]
        },
        "parking": {
            "carParks": ["Q-Park Glasgow (£12/day)", "Buchanan Galleries NCP (£10/day)"],
            "publicTransport": ["Subway: Buchanan Street (5 min walk)", "Rail: Glasgow Queen Street (5 min walk)"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": True, "quietSpaces": False,
            "bsl": False, "assistance": True,
            "details": "Venues vary. City Hall fully accessible. Check individual listings."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Some late evening club events are 18+",
            "sections": ["Free outdoor stages (All Ages)", "Concert Hall shows (All Ages)", "Club events (18+)"]
        },
        "tags": ["jazz", "music", "live", "scottish", "festival"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
    {
        "id": "evt_west_end_festival_2026",
        "name": "Glasgow West End Festival",
        "description": "Scotland's largest community arts festival! Three weeks of events in Glasgow's bohemian West End — street parties, live music, theatre, comedy, and the spectacular Grand Parade.",
        "city": "Glasgow",
        "venue": "West End, Glasgow",
        "address": "Byres Road, Glasgow G12 8TT",
        "lat": 55.8724, "lng": -4.2897,
        "date": "2026-06-05", "endDate": "2026-06-21", "time": "10:00",
        "category": "Arts",
        "price": 0, "priceLabel": "Free (some events ticketed)",
        "imageUrl": "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
        "isVerified": True, "isTrending": False, "isFeatured": False,
        "ageSuitability": "All Ages", "isOutdoor": True,
        "ticketUrl": "https://www.westendfestival.co.uk", "ticketProvider": "Direct",
        "isSoldOut": False, "isLimitedSpaces": False,
        "attendeeCount": 15000, "averageRating": 4.6, "reviewCount": 312,
        "food": {
            "onSite": ["West End Market stalls"],
            "nearby": ["Ox and Finch (0.3mi)", "Bothy (0.2mi)", "Stravaigin (0.3mi)"]
        },
        "parking": {
            "carParks": ["Partick on-street parking", "Byres Road car park"],
            "publicTransport": ["Subway: Hillhead (2 min walk)", "Bus: 6, 6A, 44 to Byres Road"]
        },
        "accessibility": {
            "wheelchair": True, "hearingLoop": False, "quietSpaces": True,
            "bsl": False, "assistance": True,
            "details": "Byres Road is mostly flat and accessible. Grand Parade has accessible viewing areas."
        },
        "ageGuide": {
            "suitableFor": "All Ages",
            "restrictions": "Some evening events are 18+",
            "sections": ["Grand Parade (All Ages)", "Street Performances (All Ages)", "Community Events (All Ages)"]
        },
        "tags": ["arts", "community", "music", "theatre", "outdoor"],
        "lastUpdated": "2026-02-01T00:00:00Z", "source": "seeded"
    },
]


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class UserProfileModel(BaseModel):
    user_id: str
    username: str
    display_name: str
    avatar_index: int = 0
    city: str = "London"
    bio: str = ""

class GoingEventModel(BaseModel):
    user_id: str
    username: str
    event_id: str
    privacy: str = "public"  # "public" | "private"

class FriendRequestModel(BaseModel):
    from_user_id: str
    from_username: str
    to_username: str

class AcceptRequestModel(BaseModel):
    user_id: str

class ReviewModel(BaseModel):
    user_id: str
    username: str
    event_id: str
    rating: int = Field(ge=1, le=5)
    text: str


# ─── Startup: Seed Events ────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    # Seed UK events if collection is empty
    count = await db.events.count_documents({})
    if count == 0:
        logger.info("Seeding UK events...")
        for event in UK_EVENTS:
            await db.events.insert_one({**event})
        logger.info(f"Seeded {len(UK_EVENTS)} events.")
    await db.events.create_index("city")
    await db.events.create_index("category")
    await db.events.create_index("id", unique=True)
    await db.events.create_index("date")
    await db.users.create_index("username", unique=True, sparse=True)
    await db.friend_requests.create_index([("from_user_id", 1), ("to_username", 1)])
    await db.going_events.create_index([("user_id", 1), ("event_id", 1)])
    await db.ai_cache.create_index("city", unique=True)


# ─── Events Routes ────────────────────────────────────────────────────────────

@api_router.get("/events")
async def get_events(
    city: str = "London",
    category: Optional[str] = None,
    budget: Optional[str] = None,  # free, under5, under10, under20, any
    search: Optional[str] = None,
    kids_mode: bool = False,
    page: int = 1,
    limit: int = 20,
):
    query: dict = {"city": {"$regex": city, "$options": "i"}}

    if kids_mode:
        query["ageSuitability"] = {"$in": ["All Ages", "Family"]}

    if category and category != "All":
        query["category"] = category

    if budget:
        if budget == "free":
            query["price"] = 0
        elif budget == "under5":
            query["price"] = {"$lte": 5}
        elif budget == "under10":
            query["price"] = {"$lte": 10}
        elif budget == "under20":
            query["price"] = {"$lte": 20}

    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    skip = (page - 1) * limit
    cursor = db.events.find(query).sort("date", 1).skip(skip).limit(limit)
    events = await cursor.to_list(length=limit)
    return [clean(e) for e in events]


@api_router.get("/events/featured")
async def get_featured_events():
    cursor = db.events.find({"isFeatured": True})
    events = await cursor.to_list(length=50)
    return [clean(e) for e in events]


@api_router.get("/events/{event_id}")
async def get_event(event_id: str):
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return clean(event)


@api_router.get("/cities")
async def get_cities():
    cities = await db.events.distinct("city")
    return sorted(cities)


# ─── AI Event Search ─────────────────────────────────────────────────────────

@api_router.post("/ai/events")
async def ai_search_events(body: dict):
    city = body.get("city", "London")
    interests = body.get("interests", [])
    age_group = body.get("age_group", "adult")
    force = body.get("force_refresh", False)

    now = datetime.now(timezone.utc)

    # Cache check — skip regeneration if under 3 hours old
    if not force:
        cache = await db.ai_cache.find_one({"city": city})
        if cache and cache.get("generatedAt"):
            try:
                gen_time = datetime.fromisoformat(cache["generatedAt"].replace("Z", "+00:00"))
                if (now - gen_time).total_seconds() < 21600:  # 6 hours
                    cursor = db.events.find(
                        {"city": {"$regex": f"^{city}$", "$options": "i"}}
                    ).sort("date", 1).limit(30)
                    events = await cursor.to_list(length=30)
                    return {"events": [clean(e) for e in events], "source": "cached"}
            except Exception:
                pass

    # Generate fresh AI events
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import json as json_lib

        api_key = os.environ.get("EMERGENT_LLM_KEY", "")
        today_str = now.strftime("%A, %B %d, %Y")
        end_date = (now + timedelta(days=28)).strftime("%B %d, %Y")
        today_iso = now.strftime("%Y-%m-%d")
        end_iso = (now + timedelta(days=28)).strftime("%Y-%m-%d")
        updated_ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        interests_str = ", ".join(interests) if interests else "Music, Food, Arts, Outdoors"

        chat = LlmChat(
            api_key=api_key,
            session_id=f"vybe_{city}_{new_id()}",
            system_message=(
                "You are a knowledgeable local events expert. You know about concerts, festivals, "
                "markets, exhibitions, comedy shows, sports fixtures, and cultural events in cities "
                "worldwide. Generate realistic, specific, upcoming events with real venue names, "
                "accurate addresses and coordinates, and detailed descriptions."
            )
        ).with_model("anthropic", "claude-sonnet-4-6")

        prompt = f"""Today is {today_str}. Generate exactly 10 upcoming events in {city} happening between {today_iso} and {end_iso}.

USER CONTEXT: Interests = {interests_str}. Age group = {age_group}.

REQUIREMENTS:
- Use REAL venue names that exist in {city} (arenas, theatres, galleries, parks, markets)
- Dates MUST be between {today_iso} and {end_iso}
- Include a variety: concerts, food markets, arts, family events, comedy, sports, outdoor
- Mix of FREE (price: 0) and PAID events
- Rich 2-3 sentence descriptions specific to that event
- Accurate lat/lng coordinates for venues in {city}

Return ONLY a valid JSON array, no markdown, no explanation. Use this exact structure:

[
  {{
    "id": "ai_{city.lower().replace(' ', '_')}_1",
    "name": "Real Event Name",
    "description": "Engaging 2-3 sentence description of what to expect at this event.",
    "city": "{city}",
    "venue": "Real Venue Name",
    "address": "Full address, {city}",
    "lat": 51.5074,
    "lng": -0.1278,
    "date": "{today_iso}",
    "endDate": "{today_iso}",
    "time": "19:00",
    "category": "Music",
    "price": 15,
    "priceLabel": "£15",
    "imageUrl": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
    "isVerified": true,
    "isTrending": false,
    "isFeatured": false,
    "ageSuitability": "All Ages",
    "isOutdoor": false,
    "ticketUrl": "https://www.eventbrite.co.uk",
    "ticketProvider": "Eventbrite",
    "isSoldOut": false,
    "isLimitedSpaces": false,
    "attendeeCount": 500,
    "averageRating": 0.0,
    "reviewCount": 0,
    "food": {{"onSite": ["Bar & snacks"], "nearby": ["Local restaurant (0.3mi)"]}},
    "parking": {{"carParks": ["Nearest car park (£8)"], "publicTransport": ["Bus / Metro info"]}},
    "accessibility": {{"wheelchair": true, "hearingLoop": false, "quietSpaces": false, "bsl": false, "assistance": true, "details": "Please contact venue for accessibility needs."}},
    "ageGuide": {{"suitableFor": "All Ages", "restrictions": "None", "sections": ["Main area"]}},
    "tags": ["event", "{city.lower()}"],
    "lastUpdated": "{updated_ts}",
    "source": "ai_generated"
  }}
]

Category-appropriate image URLs:
- Music: https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80
- Food: https://images.unsplash.com/photo-1551883709-2516220df0bc?w=800&q=80
- Arts: https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80
- Family: https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=800&q=80
- Sports: https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=80
- Comedy: https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800&q=80
- Markets: https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80
- Outdoors: https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80"""

        response = await chat.send_message(UserMessage(text=prompt))
        text = response.strip()

        # Strip markdown fences if present
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        ai_events = json_lib.loads(text)
        if not isinstance(ai_events, list):
            raise ValueError("Response is not a list")

        # Delete old AI events for this city, keep seeded ones as fallback
        await db.events.delete_many({
            "city": {"$regex": f"^{city}$", "$options": "i"},
            "source": "ai_generated"
        })

        # Insert new AI events
        saved = 0
        for i, event in enumerate(ai_events):
            event["id"] = f"ai_{city.lower().replace(' ', '_')}_{i+1}_{new_id()[:6]}"
            event["city"] = city
            event["source"] = "ai_generated"
            try:
                await db.events.insert_one(dict(event))
                saved += 1
            except Exception:
                pass

        logger.info(f"AI generated {saved} events for {city}")

        # Update cache
        await db.ai_cache.replace_one(
            {"city": city},
            {"city": city, "generatedAt": now.isoformat(), "count": saved},
            upsert=True
        )

        # Return all events sorted by date (AI first since they're near-term)
        cursor = db.events.find(
            {"city": {"$regex": f"^{city}$", "$options": "i"}}
        ).sort("date", 1).limit(30)
        events = await cursor.to_list(length=30)
        return {"events": [clean(e) for e in events], "source": "ai_generated", "count": saved}

    except Exception as e:
        logger.error(f"AI events error for {city}: {e}")
        # Fallback: return seeded events for this city
        cursor = db.events.find(
            {"city": {"$regex": f"^{city}$", "$options": "i"}}
        ).sort("date", 1).limit(30)
        events = await cursor.to_list(length=30)
        if not events:
            # Last resort: any events
            cursor = db.events.find({}).limit(10)
            events = await cursor.to_list(length=10)
        return {"events": [clean(e) for e in events], "source": "fallback", "error": str(e)}


# ─── User Routes ─────────────────────────────────────────────────────────────

@api_router.post("/user/profile")
async def upsert_user_profile(body: UserProfileModel):
    existing = await db.users.find_one({"user_id": body.user_id})
    data = body.dict()
    data["updatedAt"] = now_iso()
    if existing:
        await db.users.update_one({"user_id": body.user_id}, {"$set": data})
    else:
        data["createdAt"] = now_iso()
        await db.users.insert_one(data)
    return clean(data)


@api_router.get("/user/profile/{username}")
async def get_user_by_username(username: str):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return clean(user)


@api_router.post("/user/going")
async def mark_going(body: GoingEventModel):
    data = body.dict()
    data["createdAt"] = now_iso()
    await db.going_events.replace_one(
        {"user_id": body.user_id, "event_id": body.event_id},
        data, upsert=True
    )
    if body.privacy == "public":
        # Update event attendee count
        await db.events.update_one({"id": body.event_id}, {"$inc": {"attendeeCount": 1}})
    return {"success": True}


@api_router.delete("/user/going/{user_id}/{event_id}")
async def remove_going(user_id: str, event_id: str):
    await db.going_events.delete_one({"user_id": user_id, "event_id": event_id})
    return {"success": True}


@api_router.get("/user/{user_id}/going")
async def get_user_going(user_id: str):
    cursor = db.going_events.find({"user_id": user_id})
    going = await cursor.to_list(length=100)
    return [clean(g) for g in going]


@api_router.get("/event/{event_id}/going")
async def get_event_going(event_id: str):
    """Get public going list for an event (for Who's Going section)."""
    cursor = db.going_events.find({"event_id": event_id, "privacy": "public"})
    going = await cursor.to_list(length=100)
    result = []
    for g in going:
        clean(g)
        result.append({"user_id": g["user_id"], "username": g["username"]})
    return result


# ─── Friends Routes ───────────────────────────────────────────────────────────

@api_router.post("/friends/request")
async def send_friend_request(body: FriendRequestModel):
    # Check if target user exists
    target = await db.users.find_one({"username": body.to_username})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target["user_id"] == body.from_user_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    # Check if request already exists
    existing = await db.friend_requests.find_one({
        "from_user_id": body.from_user_id,
        "to_username": body.to_username,
        "status": {"$in": ["pending", "accepted"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Request already sent or already friends")

    request_data = {
        "id": new_id(),
        "from_user_id": body.from_user_id,
        "from_username": body.from_username,
        "to_user_id": target["user_id"],
        "to_username": body.to_username,
        "status": "pending",
        "createdAt": now_iso()
    }
    await db.friend_requests.insert_one(request_data)
    return clean(request_data)


@api_router.put("/friends/request/{request_id}/accept")
async def accept_friend_request(request_id: str, body: AcceptRequestModel):
    result = await db.friend_requests.update_one(
        {"id": request_id, "to_user_id": body.user_id},
        {"$set": {"status": "accepted", "updatedAt": now_iso()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"success": True}


@api_router.put("/friends/request/{request_id}/reject")
async def reject_friend_request(request_id: str):
    await db.friend_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "updatedAt": now_iso()}}
    )
    return {"success": True}


@api_router.get("/friends/{user_id}")
async def get_friends(user_id: str):
    """Get accepted friends for a user."""
    cursor = db.friend_requests.find({
        "$or": [{"from_user_id": user_id}, {"to_user_id": user_id}],
        "status": "accepted"
    })
    requests = await cursor.to_list(length=100)
    friends = []
    for req in requests:
        clean(req)
        friend_id = req["to_user_id"] if req["from_user_id"] == user_id else req["from_user_id"]
        friend_username = req["to_username"] if req["from_user_id"] == user_id else req["from_username"]
        friend_user = await db.users.find_one({"user_id": friend_id})
        friends.append({
            "requestId": req["id"],
            "userId": friend_id,
            "username": friend_username,
            "displayName": friend_user["display_name"] if friend_user else friend_username,
            "avatarIndex": friend_user["avatar_index"] if friend_user else 0,
            "city": friend_user["city"] if friend_user else "",
            "status": "accepted"
        })
    return friends


@api_router.get("/friends/requests/{user_id}")
async def get_friend_requests(user_id: str):
    """Get pending friend requests for a user (both sent and received)."""
    cursor = db.friend_requests.find({
        "$or": [{"from_user_id": user_id}, {"to_user_id": user_id}],
        "status": "pending"
    })
    requests = await cursor.to_list(length=50)
    result = []
    for req in requests:
        clean(req)
        is_sent = req["from_user_id"] == user_id
        other_id = req["to_user_id"] if is_sent else req["from_user_id"]
        other_username = req["to_username"] if is_sent else req["from_username"]
        result.append({
            "requestId": req["id"],
            "userId": other_id,
            "username": other_username,
            "displayName": other_username,
            "avatarIndex": 0,
            "city": "",
            "status": "pending_sent" if is_sent else "pending_received"
        })
    return result


# ─── Reviews Routes ───────────────────────────────────────────────────────────

@api_router.post("/reviews")
async def add_review(body: ReviewModel):
    review_data = body.dict()
    review_data["id"] = new_id()
    review_data["createdAt"] = now_iso()
    await db.reviews.insert_one(review_data)

    # Update event average rating
    cursor = db.reviews.find({"event_id": body.event_id})
    all_reviews = await cursor.to_list(length=1000)
    if all_reviews:
        avg = sum(r["rating"] for r in all_reviews) / len(all_reviews)
        await db.events.update_one(
            {"id": body.event_id},
            {"$set": {"averageRating": round(avg, 1), "reviewCount": len(all_reviews)}}
        )
    return clean(review_data)


@api_router.get("/reviews/{event_id}")
async def get_reviews(event_id: str):
    cursor = db.reviews.find({"event_id": event_id}).sort("createdAt", -1).limit(20)
    reviews = await cursor.to_list(length=20)
    return [clean(r) for r in reviews]


# ─── App ─────────────────────────────────────────────────────────────────────

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
