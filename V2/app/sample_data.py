"""
Sample dataset from PRD section 18 (Sample Input Data), used by
POST /api/graph/reset so demo runs are repeatable (FR-9).
"""

SAMPLE_ENTITIES_CSV = """id,type,name,phone
e1,Person,Rakesh Verma,+91-9876543210
e2,Person,Sanjay Patel,+91-9876500000
e3,Vehicle,MH-04-AB-1234,
e4,Location,Cafe Coastal Mumbai,
e5,Organization,Coastal Shipping & Logistics LLC,
e6,PhoneNumber,+91-9876543210,
"""

SAMPLE_RELATIONSHIPS_CSV = """source,target,relation_type,event_id
e1,e2,MET_AT,ev1
e1,e3,OWNS_VEHICLE,ev1
e1,e4,LOCATED_AT,ev1
e1,e5,MEMBER_OF,ev1
e1,e6,ASSOCIATED_WITH,ev1
e2,e6,ASSOCIATED_WITH,ev1
e1,e2,CALLED,ev2
"""

SAMPLE_TEXT_REPORT = (
    "On 12 March, Rakesh Verma met Sanjay Patel at Cafe Coastal, Mumbai. "
    "Rakesh called +91-9876543210 minutes later. A car with plate MH-04-AB-1234 "
    "was seen parked outside for the duration of the meeting. Corporate filings show "
    "Rakesh Verma is affiliated with Coastal Shipping & Logistics LLC."
)
