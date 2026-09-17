"""
Module: Crime Investigation Profiles Service (app/crime_profiles.py)
Provides reusable configurations for 11 digital investigation profiles.
All profiles share the same underlying NetworkX graph, analytics, and evidence registry.
Profiles configure priority entity types, relationship types, evidence types, timeline priorities,
investigative questions, and lead scoring weights.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class CrimeProfile(BaseModel):
    id: str
    name: str
    description: str
    important_entity_types: List[str] = Field(default_factory=list)
    important_relationship_types: List[str] = Field(default_factory=list)
    relevant_evidence_types: List[str] = Field(default_factory=list)
    important_attributes: List[str] = Field(default_factory=list)
    analytics: List[str] = Field(default_factory=list)
    patterns: List[str] = Field(default_factory=list)
    investigation_questions: List[str] = Field(default_factory=list)
    lead_scoring_weights: Dict[str, float] = Field(default_factory=dict)


# Definition of the 11 Standard Digital Investigation Profiles
CRIME_PROFILES: Dict[str, CrimeProfile] = {
    "murder_homicide": CrimeProfile(
        id="murder_homicide",
        name="Murder / Homicide",
        description="Investigation of intentional homicide, violent offenses, and associated conspiratorial circles.",
        important_entity_types=["Person", "Location", "Vehicle", "PhoneNumber", "Organization"],
        important_relationship_types=["CALLED", "VISITED", "LOCATED_AT", "OWNS_VEHICLE", "ASSOCIATED_WITH", "MET_AT"],
        relevant_evidence_types=["Crime Scene Log", "Forensic Autopsy Report", "Telecom CDR", "CCTV Surveillance", "Witness Statement"],
        important_attributes=["role", "last_seen", "weapon_type", "vehicle_plate", "imei", "alibi_status"],
        analytics=["timeline", "communication_correlation", "location_correlation", "vehicle_correlation", "connection_paths", "centrality"],
        patterns=["broker", "repeated_cooccurrence", "dense_subgroup", "shared_attribute"],
        investigation_questions=[
            "Who maintained direct communication with the victim immediately prior to or after the incident window?",
            "Which individuals, burner phones, or vehicles were observed at or near the primary crime scene locations?",
            "What recurring co-occurrences or meetings connect secondary associates to the primary victim or scene?",
            "Which registered vehicles were positioned or in transit across the relevant geographical corridor?",
            "What shortest connection paths link key witnesses, persons of interest, and documented physical evidence?"
        ],
        lead_scoring_weights={
            "evidence_support": 25.0,
            "relationship_repetition": 20.0,
            "timeline_correlation": 20.0,
            "cross_community": 10.0,
            "shared_attributes": 15.0,
            "graph_position": 10.0
        }
    ),
    "kidnapping_abduction": CrimeProfile(
        id="kidnapping_abduction",
        name="Kidnapping / Abduction",
        description="Investigation of hostage abduction, unlawful detention, extortionate demand channels, and safehouse transit networks.",
        important_entity_types=["Person", "Location", "Vehicle", "PhoneNumber", "Organization"],
        important_relationship_types=["CALLED", "MESSAGED", "VISITED", "LOCATED_AT", "OWNS_VEHICLE", "ASSOCIATED_WITH"],
        relevant_evidence_types=["Ransom Call Recording", "Tower Dump CDR", "ANPR License Plate Intercept", "GPS Fleet Log", "Surveillance Note"],
        important_attributes=["role", "drop_location", "call_duration", "plate", "cell_tower_id", "ransom_channel"],
        analytics=["timeline", "communication_correlation", "transit_paths", "location_correlation", "community_detection"],
        patterns=["shared_attribute", "broker", "repeated_cooccurrence", "dense_subgroup"],
        investigation_questions=[
            "Which mobile identifiers or burner SIMs communicated with the victim or victim's family during demand intervals?",
            "What safehouse, transit, or drop locations appear across multiple surveillance or telemetry logs?",
            "Which vehicles are associated with transit routes between the abduction point and potential holding facilities?",
            "What communication brokers connect the frontline callers with supervisory or financial intermediaries?",
            "Which entities bridge disparate local cells involved in logistical support versus communication?"
        ],
        lead_scoring_weights={
            "evidence_support": 25.0,
            "relationship_repetition": 25.0,
            "timeline_correlation": 20.0,
            "cross_community": 10.0,
            "shared_attributes": 10.0,
            "graph_position": 10.0
        }
    ),
    "robbery_theft": CrimeProfile(
        id="robbery_theft",
        name="Robbery / Theft",
        description="Investigation of armed robberies, commercial burglary rings, heist logistics, and fenced goods channels.",
        important_entity_types=["Person", "Location", "Vehicle", "PhoneNumber", "Organization"],
        important_relationship_types=["PARTICIPATED_IN", "SEEN_AT", "OWNS_VEHICLE", "CALLED", "ASSOCIATED_WITH"],
        relevant_evidence_types=["ANPR Camera Capture", "CCTV Footage Log", "Pawn / Fencing Ledger", "Forensic Tool Mark", "Telecom CDR"],
        important_attributes=["role", "plate", "make_model", "target_facility", "stolen_asset_ref", "recon_timestamp"],
        analytics=["location_correlation", "vehicle_correlation", "timeline", "clique_detection", "centrality"],
        patterns=["dense_subgroup", "shared_attribute", "repeated_cooccurrence", "broker"],
        investigation_questions=[
            "Which vehicles and persons were sighted near the target facility during reconnaissance windows?",
            "What communication spike occurred among co-located associates during the execution of the heist?",
            "Which entities bridge the tactical execution group with commercial outlets or fenced merchandise brokers?",
            "Are there common vehicle assets or shared burner hardware deployed across multiple incident reports?",
            "Which tightly interconnected subgroup matches the operational footprint of known burglary crews?"
        ],
        lead_scoring_weights={
            "evidence_support": 20.0,
            "relationship_repetition": 20.0,
            "timeline_correlation": 20.0,
            "cross_community": 15.0,
            "shared_attributes": 15.0,
            "graph_position": 10.0
        }
    ),
    "cybercrime": CrimeProfile(
        id="cybercrime",
        name="Cybercrime",
        description="Investigation of unauthorized intrusion, ransomware deployment, credential harvesting, botnet infrastructure, and digital laundering.",
        important_entity_types=["Person", "Organization", "PhoneNumber", "Location", "Event"],
        important_relationship_types=["ASSOCIATED_WITH", "CALLED", "MEMBER_OF", "PARTICIPATED_IN", "LOCATED_AT"],
        relevant_evidence_types=["Firewall / Syslog Extract", "IP Access Log", "Crypto Wallet Transfer Ledger", "Darknet Forum Intercept", "Domain Whois"],
        important_attributes=["ip_address", "mac_address", "wallet_address", "handle", "email", "server_port", "c2_domain"],
        analytics=["centrality", "community_detection", "timeline", "shortest_path", "infrastructure_clustering"],
        patterns=["broker", "shared_attribute", "dense_subgroup", "repeated_cooccurrence"],
        investigation_questions=[
            "Which IP addresses, digital handles, or server nodes exhibit high degree connectivity across separate victim networks?",
            "What communication channels link malware developers, access brokers, and operational cash-out crews?",
            "Which financial or cryptocurrency routing points bridge independent technical attack clusters?",
            "What chronological sequence of login events and server calls precedes the unauthorized extraction?",
            "Are multiple online personas sharing common backend infrastructure, hosting providers, or phone authenticators?"
        ],
        lead_scoring_weights={
            "evidence_support": 25.0,
            "relationship_repetition": 15.0,
            "timeline_correlation": 20.0,
            "cross_community": 20.0,
            "shared_attributes": 10.0,
            "graph_position": 10.0
        }
    ),
    "financial_fraud": CrimeProfile(
        id="financial_fraud",
        name="Financial Fraud",
        description="Investigation of corporate embezzlement, fraudulent investment syndicates, Hawala channels, and multi-tier money laundering.",
        important_entity_types=["Person", "Organization", "Location", "PhoneNumber", "Event"],
        important_relationship_types=["ASSOCIATED_WITH", "MEMBER_OF", "LOCATED_AT", "CALLED", "PARTICIPATED_IN"],
        relevant_evidence_types=["Bank Transaction Ledger", "Hawala Chit Record", "Corporate Registry Filing", "Auditor Forensic Report", "Wire Transfer SWIFT"],
        important_attributes=["account_number", "company_cin", "turnover_vol", "pan_ein", "director_id", "swift_code", "shell_status"],
        analytics=["centrality", "community_detection", "financial_flow_paths", "brokerage_points", "density"],
        patterns=["broker", "dense_subgroup", "shared_attribute", "repeated_cooccurrence"],
        investigation_questions=[
            "Which corporate entities and intermediary bank accounts act as high-betweenness bridges between source funds and destination assets?",
            "What repeated transactional co-occurrences indicate systematic layering or round-tripping of funds?",
            "Which beneficial owners or corporate directors share registered addresses, auditor firms, or contact numbers?",
            "What transaction velocity and timeline pattern characterizes the disbursement across shell accounts?",
            "Which modularity community isolates the collection mules from the executive management tier?"
        ],
        lead_scoring_weights={
            "evidence_support": 25.0,
            "relationship_repetition": 20.0,
            "timeline_correlation": 15.0,
            "cross_community": 20.0,
            "shared_attributes": 10.0,
            "graph_position": 10.0
        }
    ),
    "drug_trafficking": CrimeProfile(
        id="drug_trafficking",
        name="Drug Trafficking",
        description="Investigation of narcotics import, regional distribution logistics, stash house hubs, and wholesale cartel pipelines.",
        important_entity_types=["Person", "Location", "Vehicle", "PhoneNumber", "Organization"],
        important_relationship_types=["CALLED", "MET_AT", "OWNS_VEHICLE", "LOCATED_AT", "MEMBER_OF", "ASSOCIATED_WITH"],
        relevant_evidence_types=["Wiretap Intercept Transcript", "Narcotics Seizure Memo", "Vehicle GPS Tracker Log", "Surveillance Report", "Cell Tower Matrix"],
        important_attributes=["role", "contraband_type", "courier_route", "plate", "dead_drop_point", "code_alias"],
        analytics=["community_detection", "centrality", "corridor_paths", "timeline", "dense_subgroups"],
        patterns=["broker", "dense_subgroup", "shared_attribute", "repeated_cooccurrence"],
        investigation_questions=[
            "Which key brokers link cross-border importation sources with domestic distribution cells?",
            "What transport vehicles and registered couriers regularly transit between known stash warehouses and retail hubs?",
            "Which burner communications exhibit tight clustering immediately before scheduled shipments?",
            "What physical meeting locations or transit nodes exhibit repeated multi-party co-presence?",
            "Which entities maintain structural isolation from street-level distribution while exercising steering centrality?"
        ],
        lead_scoring_weights={
            "evidence_support": 25.0,
            "relationship_repetition": 20.0,
            "timeline_correlation": 15.0,
            "cross_community": 15.0,
            "shared_attributes": 15.0,
            "graph_position": 10.0
        }
    ),
    "human_trafficking": CrimeProfile(
        id="human_trafficking",
        name="Human Trafficking",
        description="Investigation of coerced migration, forced labor rings, fraudulent recruitment conduits, and commercial exploitation networks.",
        important_entity_types=["Person", "Location", "Vehicle", "PhoneNumber", "Organization"],
        important_relationship_types=["ASSOCIATED_WITH", "LOCATED_AT", "CALLED", "MEMBER_OF", "OWNS_VEHICLE"],
        relevant_evidence_types=["Border Transit Manifest", "Employment Agency Audit", "Victim Statement", "Flight Booking Record", "Surveillance Log"],
        important_attributes=["role", "visa_type", "transit_checkpoint", "employer_agency", "passport_flag", "holding_facility"],
        analytics=["shortest_path", "community_detection", "timeline", "centrality", "location_density"],
        patterns=["broker", "dense_subgroup", "shared_attribute", "repeated_cooccurrence"],
        investigation_questions=[
            "Which recruitment agencies, front firms, and transit managers coordinate across source and destination zones?",
            "What shared contact numbers, accommodations, or employers are documented across unrelated victim dossiers?",
            "Which entities act as pivotal logistical bridges facilitating documentation, air travel, and border passage?",
            "What chronological pattern connects initial victim contact to transit movement and terminal exploitation points?",
            "Which dense clusters represent local sheltering or transportation contractors?"
        ],
        lead_scoring_weights={
            "evidence_support": 25.0,
            "relationship_repetition": 20.0,
            "timeline_correlation": 15.0,
            "cross_community": 20.0,
            "shared_attributes": 10.0,
            "graph_position": 10.0
        }
    ),
    "extortion_blackmail": CrimeProfile(
        id="extortion_blackmail",
        name="Extortion / Blackmail",
        description="Investigation of coercive threats, corporate shakedowns, protection racketeering, and intimidation networks.",
        important_entity_types=["Person", "PhoneNumber", "Organization", "Location", "Vehicle"],
        important_relationship_types=["CALLED", "MESSAGED", "ASSOCIATED_WITH", "LOCATED_AT", "OWNS_VEHICLE"],
        relevant_evidence_types=["Threat Audio Intercept", "Messaging Screenshot Log", "Hawala Drop Receipt", "Premises Vandalism Report", "Telecom CDR"],
        important_attributes=["threat_severity", "target_entity", "channel", "collection_agent", "payment_deadline", "burner_sim"],
        analytics=["communication_correlation", "centrality", "timeline", "brokerage_points"],
        patterns=["shared_attribute", "broker", "repeated_cooccurrence", "dense_subgroup"],
        investigation_questions=[
            "Which originating phone numbers, IP endpoints, or messaging identifiers initiated coercive demands?",
            "What intermediary couriers or drop locations connect extortion callers with the beneficiary syndicate?",
            "Which individuals share burner SIM cards or communication handsets used during threat windows?",
            "What timeline of demands correlates with physical intimidation or surveillance visits at the victim's premises?",
            "Which high-betweenness entity appears to direct multiple intimidation incidents against separate commercial targets?"
        ],
        lead_scoring_weights={
            "evidence_support": 25.0,
            "relationship_repetition": 25.0,
            "timeline_correlation": 20.0,
            "cross_community": 10.0,
            "shared_attributes": 10.0,
            "graph_position": 10.0
        }
    ),
    "smuggling": CrimeProfile(
        id="smuggling",
        name="Smuggling",
        description="Investigation of transnational contraband, customs evasion, illicit maritime shipments, and counterfeit logistics.",
        important_entity_types=["Person", "Organization", "Vehicle", "Location", "PhoneNumber"],
        important_relationship_types=["OWNS_VEHICLE", "LOCATED_AT", "ASSOCIATED_WITH", "CALLED", "MEMBER_OF"],
        relevant_evidence_types=["Port Shipping Manifest", "Customs Inspection Memo", "Bill of Lading", "Container GPS Telemetry", "Seizure Inventory"],
        important_attributes=["container_id", "vessel_imo", "customs_broker", "port_of_entry", "freight_forwarder", "cargo_code"],
        analytics=["corridor_paths", "centrality", "vehicle_correlation", "location_correlation", "community_detection"],
        patterns=["broker", "dense_subgroup", "shared_attribute", "repeated_cooccurrence"],
        investigation_questions=[
            "Which freight forwarders, customs clearing agents, and consignees repeatedly interlink across flagged shipments?",
            "What maritime vessels, commercial vehicles, or storage containers connect foreign ports to domestic warehouses?",
            "Which high-centrality brokers coordinate cargo clearance across distinct logistics companies?",
            "What recurring telecommunications link port personnel to external transportation contractors?",
            "Which modularity cluster encapsulates the financial underwriters of the contraband consignment?"
        ],
        lead_scoring_weights={
            "evidence_support": 25.0,
            "relationship_repetition": 20.0,
            "timeline_correlation": 15.0,
            "cross_community": 15.0,
            "shared_attributes": 15.0,
            "graph_position": 10.0
        }
    ),
    "organized_crime": CrimeProfile(
        id="organized_crime",
        name="Organized Crime Network",
        description="Comprehensive investigation of hierarchical syndicates, multi-enterprise underworld cartels, Hawala financiers, and command structures.",
        important_entity_types=["Person", "Organization", "PhoneNumber", "Vehicle", "Location"],
        important_relationship_types=["CALLED", "MEMBER_OF", "ASSOCIATED_WITH", "LOCATED_AT", "OWNS_VEHICLE", "MET_AT"],
        relevant_evidence_types=["Multi-Vector Wiretap", "Informant Intelligence Report", "Corporate Registry Filing", "Banking Ledger", "Surveillance Memo"],
        important_attributes=["role", "syndicate_tier", "jurisdiction", "burner_chain", "front_company", "aliases"],
        analytics=["centrality", "community_detection", "brokerage_points", "timeline", "dense_subgroups", "connection_paths"],
        patterns=["broker", "dense_subgroup", "shared_attribute", "repeated_cooccurrence"],
        investigation_questions=[
            "Which entity exhibits the highest betweenness centrality acting as the central broker between operational cells?",
            "What modularity communities represent distinct operational divisions (finance, enforcement, logistics, leadership)?",
            "Which commercial businesses or Hawala exchanges operate as financial conduits for illicit revenues?",
            "What communication bridges link street-level operatives to the supervisory executive leadership?",
            "Which individuals share operational burner phones or vehicles across ostensibly separate syndicate cells?"
        ],
        lead_scoring_weights={
            "evidence_support": 25.0,
            "relationship_repetition": 20.0,
            "timeline_correlation": 15.0,
            "cross_community": 20.0,
            "shared_attributes": 10.0,
            "graph_position": 10.0
        }
    ),
    "missing_person": CrimeProfile(
        id="missing_person",
        name="Missing Person / Unexplained Disappearance",
        description="Investigation of unexplained disappearances, vulnerable individuals, trajectory reconstruction, and last known physical/digital contacts.",
        important_entity_types=["Person", "Location", "Vehicle", "PhoneNumber", "Event"],
        important_relationship_types=["CALLED", "VISITED", "LOCATED_AT", "ASSOCIATED_WITH", "OWNS_VEHICLE"],
        relevant_evidence_types=["Last Seen Incident Report", "Cell Tower Last Ping", "Credit Card POS Record", "Transit / Toll Pass", "CCTV Footage Log"],
        important_attributes=["last_seen_date", "last_seen_location", "travel_mode", "device_battery_status", "relationship_to_subject", "vulnerability_index"],
        analytics=["timeline", "location_correlation", "communication_correlation", "shortest_path"],
        patterns=["repeated_cooccurrence", "shared_attribute", "broker", "dense_subgroup"],
        investigation_questions=[
            "Who were the final individuals in direct telecommunication contact with the missing person prior to device cessation?",
            "What geographic locations and transit toll routes map the subject's chronological trajectory?",
            "Which vehicles or transportation assets were registered near the last confirmed sighting?",
            "What sudden drop or anomaly occurred in historical communication frequency across the immediate circle?",
            "Which third parties share associations with both the missing individual and the vicinity of disappearance?"
        ],
        lead_scoring_weights={
            "evidence_support": 25.0,
            "relationship_repetition": 15.0,
            "timeline_correlation": 25.0,
            "cross_community": 10.0,
            "shared_attributes": 15.0,
            "graph_position": 10.0
        }
    )
}


def get_crime_profile(profile_id: str) -> CrimeProfile:
    """Retrieve crime profile by ID, defaulting to organized_crime if unmapped."""
    normalized_id = profile_id.strip().lower() if profile_id else "organized_crime"
    return CRIME_PROFILES.get(normalized_id, CRIME_PROFILES["organized_crime"])


def list_crime_profiles() -> List[CrimeProfile]:
    """Return all available crime profiles."""
    return list(CRIME_PROFILES.values())
