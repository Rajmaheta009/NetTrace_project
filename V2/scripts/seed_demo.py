"""
NetTrace Enterprise Seed Script (PostgreSQL / SQLite Compatible)
Seeds:
- 6 System Roles (SUPER_ADMIN, ADMIN, INVESTIGATOR, ANALYST, REVIEWER, VIEWER)
- 35+ Granular Permissions & Role-Permission Associations
- 6 Demo Accounts with Bcrypt Hashes (Zero Plaintext Passwords in DB)
- Default Protected Case `case-001` (Operation Falcon Shadow)
- Case-Level Team Assignments in `case_users`
- Baseline Intelligence: Evidence, Entities, Relationships, Leads, Notes, and Tamper-Evident Audit Logs
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.auth import (
    ALL_PERMISSIONS,
    DEFAULT_ROLE_PERMISSIONS,
    hash_password,
)
from app.audit_logger import record_audit
from app.database import (
    AuditIntegrityDB,
    AuditLogDB,
    Base,
    CaseDB,
    CaseUserDB,
    EntityDB,
    EntityAliasDB,
    EvidenceDB,
    EvidenceRecordDB,
    InvestigationLeadDB,
    NoteDB,
    PermissionDB,
    RelationshipDB,
    RoleDB,
    RolePermissionDB,
    SessionLocal,
    UserDB,
    UserRoleDB,
    engine,
)


def seed_database():
    """Initializes schema and seeds baseline intelligence and access control tables."""
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # ---------------------------------------------------------
        # 1. Seed Permissions
        # ---------------------------------------------------------
        print("Seeding permissions...")
        perm_map = {}
        for code, meta in ALL_PERMISSIONS.items():
            perm = db.query(PermissionDB).filter(PermissionDB.code == code).first()
            if not perm:
                perm = PermissionDB(
                    code=code,
                    description=meta["desc"],
                    category=meta["cat"],
                )
                db.add(perm)
                db.flush()
            perm_map[code] = perm

        db.commit()

        # ---------------------------------------------------------
        # 2. Seed Roles & Role Permissions
        # ---------------------------------------------------------
        print("Seeding roles and role-permission mappings...")
        role_map = {}
        role_descriptions = {
            "SUPER_ADMIN": "System Owner with full administrative and security authority",
            "ADMIN": "Operational Administrator managing cases, users, and evidence",
            "INVESTIGATOR": "Lead Investigator conducting intelligence analysis and merging entities",
            "ANALYST": "Intelligence Analyst computing graph centrality, paths, and patterns",
            "REVIEWER": "Data Quality Reviewer validating findings and false positives",
            "VIEWER": "Judicial / Oversight Reviewer with strict read-only access",
        }

        for role_name, perms in DEFAULT_ROLE_PERMISSIONS.items():
            role = db.query(RoleDB).filter(RoleDB.name == role_name).first()
            if not role:
                role = RoleDB(
                    name=role_name,
                    description=role_descriptions.get(role_name, f"System role {role_name}"),
                    is_system_role=True,
                )
                db.add(role)
                db.flush()
            role_map[role_name] = role

            # Assign permissions
            for p_code in set(perms):
                p_obj = perm_map.get(p_code)
                if p_obj:
                    rp = db.query(RolePermissionDB).filter(
                        RolePermissionDB.role_id == role.id,
                        RolePermissionDB.permission_id == p_obj.id,
                    ).first()
                    if not rp:
                        db.add(RolePermissionDB(role_id=role.id, permission_id=p_obj.id))

        db.commit()

        # ---------------------------------------------------------
        # 3. Seed Demo Users
        # ---------------------------------------------------------
        print("Seeding demo user accounts with secure bcrypt hashes...")
        demo_users_data = [
            {
                "id": "USR-SADMIN-01",
                "username": "superadmin",
                "email": "superadmin@nettrace.local",
                "password": "SuperAdmin123!",
                "full_name": "DG Alok Varma (Director General)",
                "department": "National Intelligence Directorate",
                "designation": "Director General",
                "role": "SUPER_ADMIN",
                "api_token": "token_superadmin_master",
            },
            {
                "id": "USR-ADMIN-01",
                "username": "admin",
                "email": "admin@nettrace.local",
                "password": "Admin123!",
                "full_name": "Director Sharma (System Administrator)",
                "department": "Cyber Intelligence & Security",
                "designation": "Director",
                "role": "ADMIN",
                "api_token": "token_admin_supersecret",
            },
            {
                "id": "USR-INV-01",
                "username": "investigator",
                "email": "investigator@nettrace.local",
                "password": "Investigator123!",
                "full_name": "Officer Vikram (Lead Investigator)",
                "department": "Organized Crime & Hawala Taskforce",
                "designation": "Superintendent of Police",
                "role": "INVESTIGATOR",
                "api_token": "token_investigator_primary",
            },
            {
                "id": "USR-ANA-01",
                "username": "analyst",
                "email": "analyst@nettrace.local",
                "password": "Analyst123!",
                "full_name": "Priya Patel (Intelligence Analyst)",
                "department": "Network Intelligence & Graphs",
                "designation": "Senior Intelligence Analyst",
                "role": "ANALYST",
                "api_token": "token_analyst_intel",
            },
            {
                "id": "USR-REV-01",
                "username": "reviewer",
                "email": "reviewer@nettrace.local",
                "password": "Reviewer123!",
                "full_name": "Aryan Sen (Forensic Reviewer)",
                "department": "Evidence Validation & Forensic Integrity",
                "designation": "Chief Forensic Examiner",
                "role": "REVIEWER",
                "api_token": "token_reviewer_forensic",
            },
            {
                "id": "USR-VIEW-01",
                "username": "viewer",
                "email": "viewer@nettrace.local",
                "password": "Viewer123!",
                "full_name": "Magistrate Kulkarni (Judicial Reviewer)",
                "department": "Judicial Oversight Bench",
                "designation": "Judicial Magistrate First Class",
                "role": "VIEWER",
                "api_token": "token_viewer_readonly",
            },
        ]

        user_map = {}
        for u in demo_users_data:
            user = db.query(UserDB).filter(UserDB.username == u["username"]).first()
            if not user:
                user = UserDB(
                    id=u["id"],
                    username=u["username"],
                    email=u["email"],
                    password_hash=hash_password(u["password"]),
                    full_name=u["full_name"],
                    department=u["department"],
                    designation=u["designation"],
                    status="ACTIVE",
                    created_at=now_str,
                    updated_at=now_str,
                    role=u["role"],
                    api_token=u["api_token"],
                )
                db.add(user)
                db.flush()

                # Assign role in user_roles
                role_obj = role_map.get(u["role"])
                if role_obj:
                    db.add(UserRoleDB(user_id=user.id, role_id=role_obj.id))
            user_map[u["username"]] = user

        db.commit()

        # ---------------------------------------------------------
        # 4. Seed Default Protected Case
        # ---------------------------------------------------------
        print("Seeding default protected investigation case...")
        c1 = db.query(CaseDB).filter(CaseDB.case_id == "case-001").first()
        if not c1:
            c1 = CaseDB(
                case_id="case-001",
                case_name="Operation Falcon Shadow",
                description="Transnational gold smuggling, Hawala conduits, and port clearance racket operating across UAE and Mumbai.",
                investigation_type="smuggling",
                status="OPEN",
                priority="Critical",
                is_protected=True,
                created_at=now_str,
                updated_at=now_str,
                created_by="Officer Vikram (Lead)",
            )
            db.add(c1)
            db.flush()

        # Assign case team in case_users
        assignments = [
            ("admin", "CASE_OWNER"),
            ("investigator", "INVESTIGATOR"),
            ("analyst", "ANALYST"),
            ("reviewer", "REVIEWER"),
            ("viewer", "OBSERVER"),
        ]
        for uname, crole in assignments:
            u_obj = user_map.get(uname)
            if u_obj:
                cu = db.query(CaseUserDB).filter(
                    CaseUserDB.case_id == "case-001",
                    CaseUserDB.user_id == u_obj.id,
                ).first()
                if not cu:
                    db.add(CaseUserDB(
                        case_id="case-001",
                        user_id=u_obj.id,
                        case_role=crole,
                        assigned_by="System Provisioner",
                        assigned_at=now_str,
                    ))

        db.commit()

        # ---------------------------------------------------------
        # 5. Seed Surveillance Evidence Artifact
        # ---------------------------------------------------------
        print("Seeding primary surveillance evidence artifact...")
        ev = db.query(EvidenceDB).filter(
            EvidenceDB.case_id == "case-001",
            EvidenceDB.evidence_id == "EV-SEED-FALCON-01",
        ).first()

        raw_sample = (
            "id,type,name,aliases,phone,role\n"
            "p1,Person,Ahmed Khan,Tiger;Bhai,+971501234567,Syndicate Head\n"
            "p2,Person,Rakesh Verma,Cashier;Munshi,+919820098200,Hawala Broker\n"
            "p3,Person,Rashid Al-Falasi,Sheikh;Al-Emirate,+971559876543,Financier\n"
            "o1,Organization,Golden Horizon Trading LLC,GHT Gulf,N/A,Gold Import Shell\n"
            "v1,Vehicle,MH-01-CR-9999,Black Fortuner,N/A,Transport Vehicle"
        )
        import hashlib
        ev_hash = hashlib.sha256(raw_sample.encode("utf-8")).hexdigest()

        if not ev:
            ev = EvidenceDB(
                evidence_id="EV-SEED-FALCON-01",
                case_id="case-001",
                filename="surveillance_falcon_primary.csv",
                original_filename="surveillance_falcon_primary.csv",
                source_type="CSV",
                mime_type="text/csv",
                file_size=len(raw_sample.encode("utf-8")),
                sha256_hash=ev_hash,
                uploaded_at=now_str,
                uploaded_by="Officer Vikram",
                source_system="Directorate of Revenue Intelligence / NetTrace",
                acquisition_timestamp=now_str,
                processing_timestamp=now_str,
                parser_version="v2.2-deterministic",
                record_count=5,
                description="Intercepted CDR logs, corporate registries, and surveillance manifests for Operation Falcon Shadow.",
                processing_status="Completed",
                raw_content=raw_sample,
            )
            db.add(ev)
            db.flush()

        # ---------------------------------------------------------
        # 6. Seed Baseline Entities & Aliases
        # ---------------------------------------------------------
        print("Seeding core verified entities...")
        entities_data = [
            {
                "entity_id": "P-001",
                "type": "Person",
                "name": "Ahmed Khan",
                "normalized_name": "ahmed khan",
                "phone": "+971501234567",
                "aliases": ["Tiger", "Bhai", "Boss"],
                "attributes": {"role": "Kingpin / Syndicate Head", "nationality": "Indian", "passport": "Z1829302"},
            },
            {
                "entity_id": "P-002",
                "type": "Person",
                "name": "Rakesh Verma",
                "normalized_name": "rakesh verma",
                "phone": "+919820098200",
                "aliases": ["Cashier", "Munshi"],
                "attributes": {"role": "Mumbai Hawala Conduit", "address": "Zaveri Bazaar, Mumbai"},
            },
            {
                "entity_id": "P-003",
                "type": "Person",
                "name": "Rashid Al-Falasi",
                "normalized_name": "rashid al-falasi",
                "phone": "+971559876543",
                "aliases": ["Sheikh", "Al-Emirate"],
                "attributes": {"role": "Dubai Financier & Bullion Supplier", "city": "Dubai"},
            },
            {
                "entity_id": "O-001",
                "type": "Organization",
                "name": "Golden Horizon Trading LLC",
                "normalized_name": "golden horizon trading llc",
                "phone": "+97142001122",
                "aliases": ["GHT Gulf", "Golden Horizon"],
                "attributes": {"jurisdiction": "Deira Gold Souq, UAE", "registration": "DED-892102"},
            },
            {
                "entity_id": "V-001",
                "type": "Vehicle",
                "name": "MH-01-CR-9999",
                "normalized_name": "mh-01-cr-9999",
                "vehicle_plate": "MH-01-CR-9999",
                "aliases": ["Black Fortuner"],
                "attributes": {"make": "Toyota", "model": "Fortuner", "color": "Jet Black"},
            },
        ]

        for ed in entities_data:
            existing_e = db.query(EntityDB).filter(
                EntityDB.case_id == "case-001",
                EntityDB.entity_id == ed["entity_id"],
            ).first()

            if not existing_e:
                ent = EntityDB(
                    entity_id=ed["entity_id"],
                    case_id="case-001",
                    type=ed["type"],
                    name=ed["name"],
                    normalized_name=ed["normalized_name"],
                    phone=ed.get("phone"),
                    vehicle_plate=ed.get("vehicle_plate"),
                    aliases_json=json.dumps(ed["aliases"]),
                    attributes_json=json.dumps(ed["attributes"]),
                    source_refs_json=json.dumps(["surveillance_falcon_primary.csv"]),
                    evidence_id="EV-SEED-FALCON-01",
                    source_file="surveillance_falcon_primary.csv",
                    validation_status="Valid",
                    is_merged=False,
                    created_at=now_str,
                    updated_at=now_str,
                )
                db.add(ent)
                db.flush()

                # Seed aliases in entity_aliases
                for a in ed["aliases"]:
                    db.add(EntityAliasDB(
                        entity_id=ed["entity_id"],
                        case_id="case-001",
                        alias=a,
                        normalized_alias=a.strip().lower(),
                        created_at=now_str,
                    ))

        # ---------------------------------------------------------
        # 7. Seed Directional & Symmetric Relationships
        # ---------------------------------------------------------
        print("Seeding evidentiary relationships...")
        relationships_data = [
            {
                "rel_id": "REL-SEED-01",
                "source_id": "P-001",
                "target_id": "P-002",
                "relation_type": "CALLED",
                "is_directed": True,
                "weight": 14,
                "confidence": 0.95,
                "confidence_label": "Very Strong",
                "confidence_reasons": ["Direct telecommunications intercept (+0.20)", "Repeated co-occurrence across 14 events (+0.15)"],
                "evidence": ["Intercepted call session 2026-08-14 23:14:02 IST (Duration: 340s)"],
                "suspected_crime": "Telecommunications Coordination of Smuggling",
                "crime_category": "Communication Conduits",
                "legal_statutes": ["Section 135 Customs Act, 1962"],
            },
            {
                "rel_id": "REL-SEED-02",
                "source_id": "P-002",
                "target_id": "P-001",
                "relation_type": "MESSAGED",
                "is_directed": True,
                "weight": 8,
                "confidence": 0.88,
                "confidence_label": "Strong",
                "confidence_reasons": ["Encrypted messaging intercept (+0.20)"],
                "evidence": ["Telegram drop verification: 'Delivery token: 994-Alpha confirmed'"],
                "suspected_crime": "Hawala Remittance Confirmation",
                "crime_category": "Financial Logistics",
                "legal_statutes": ["Section 3 & 4 FEMA / PMLA 2002"],
            },
            {
                "rel_id": "REL-SEED-03",
                "source_id": "P-003",
                "target_id": "O-001",
                "relation_type": "OWNS",
                "is_directed": True,
                "weight": 1,
                "confidence": 0.99,
                "confidence_label": "Very Strong",
                "confidence_reasons": ["Corporate registry documentation (+0.25)"],
                "evidence": ["Dubai Economy & Tourism Trade License #892102"],
                "suspected_crime": "Shell Company Beneficial Ownership",
                "crime_category": "Money Laundering Conduit",
                "legal_statutes": ["UAE Federal Decree Law No. 20 / PMLA Sec 3"],
            },
            {
                "rel_id": "REL-SEED-04",
                "source_id": "P-001",
                "target_id": "P-003",
                "relation_type": "MET_AT",
                "is_directed": False,
                "weight": 4,
                "confidence": 0.82,
                "confidence_label": "Strong",
                "confidence_reasons": ["Physical co-presence at surveillance site (+0.10)"],
                "evidence": ["CCTV recording at Dubai Gold Souq Coffee Lounge 2026-08-10"],
                "suspected_crime": "Criminal Conspiracy & Procurement Planning",
                "crime_category": "Consortium Coordination",
                "legal_statutes": ["Section 120B IPC / BNS 61"],
            },
            {
                "rel_id": "REL-SEED-05",
                "source_id": "P-002",
                "target_id": "V-001",
                "relation_type": "SEEN_IN_VEHICLE",
                "is_directed": True,
                "weight": 6,
                "confidence": 0.91,
                "confidence_label": "Very Strong",
                "confidence_reasons": ["Physical co-presence (+0.10)", "Motor vehicle sighting (+0.25)"],
                "evidence": ["ANPR toll camera hit: Bandra-Worli Sea Link 2026-08-15 02:14 IST"],
                "suspected_crime": "Contraband Movement & Logistics",
                "crime_category": "Physical Courier Transit",
                "legal_statutes": ["Customs Act Section 115 (Confiscation of conveyances)"],
            },
        ]

        for rd in relationships_data:
            existing_r = db.query(RelationshipDB).filter(
                RelationshipDB.case_id == "case-001",
                RelationshipDB.rel_id == rd["rel_id"],
            ).first()

            if not existing_r:
                r = RelationshipDB(
                    rel_id=rd["rel_id"],
                    case_id="case-001",
                    source_id=rd["source_id"],
                    target_id=rd["target_id"],
                    relation_type=rd["relation_type"],
                    is_directed=rd["is_directed"],
                    weight=rd["weight"],
                    confidence=rd["confidence"],
                    confidence_label=rd["confidence_label"],
                    confidence_reasons_json=json.dumps(rd["confidence_reasons"]),
                    evidence_json=json.dumps(rd["evidence"]),
                    evidence_id="EV-SEED-FALCON-01",
                    source_file="surveillance_falcon_primary.csv",
                    validation_status="Valid",
                    occurrences=rd["weight"],
                    suspected_crime=rd.get("suspected_crime"),
                    crime_category=rd.get("crime_category"),
                    legal_statutes_json=json.dumps(rd.get("legal_statutes", [])),
                    crime_severity="High" if rd["weight"] > 5 else "Moderate",
                    evidentiary_sufficiency="Prima Facie Documented",
                    created_at=now_str,
                    updated_at=now_str,
                )
                db.add(r)

        # ---------------------------------------------------------
        # 8. Seed Prioritized Investigation Leads
        # ---------------------------------------------------------
        print("Seeding priority investigation leads...")
        leads_data = [
            {
                "lead_id": "LEAD-001",
                "entity_id": "P-001",
                "title": "Ahmed Khan — Key Orchestrator & Syndicate Broker",
                "score": 0.94,
                "score_category": "Priority 1 (Orchestrator)",
                "why_flagged": [
                    "High Betweenness Centrality: Acts as broker bridging Mumbai hawala network with UAE suppliers.",
                    "Direct telecommunication intercept with confirmed Hawala operative Rakesh Verma.",
                    "Co-presence at Gold Souq procurement meeting documented via foreign intelligence liaison.",
                ],
                "metrics": {"degree": 3, "betweenness": 0.88, "eigenvector": 0.79},
            },
            {
                "lead_id": "LEAD-002",
                "entity_id": "P-002",
                "title": "Rakesh Verma — High-Frequency Hawala Operator",
                "score": 0.86,
                "score_category": "Priority 1 (Conduit)",
                "why_flagged": [
                    "Repeated nocturnal ANPR toll hits inside transport vehicle MH-01-CR-9999.",
                    "Bidirectional intercept flow (14 inbound calls, 8 outbound token confirmation messages).",
                ],
                "metrics": {"degree": 3, "betweenness": 0.72, "eigenvector": 0.65},
            },
        ]

        for ld in leads_data:
            existing_lead = db.query(InvestigationLeadDB).filter(
                InvestigationLeadDB.case_id == "case-001",
                InvestigationLeadDB.lead_id == ld["lead_id"],
            ).first()

            if not existing_lead:
                lead = InvestigationLeadDB(
                    lead_id=ld["lead_id"],
                    case_id="case-001",
                    entity_id=ld["entity_id"],
                    title=ld["title"],
                    score=ld["score"],
                    score_category=ld["score_category"],
                    why_flagged_json=json.dumps(ld["why_flagged"]),
                    metrics_json=json.dumps(ld["metrics"]),
                    status="ACTIVE",
                    created_at=now_str,
                    updated_at=now_str,
                )
                db.add(lead)

        # ---------------------------------------------------------
        # 9. Seed Field Notes
        # ---------------------------------------------------------
        print("Seeding investigative field notes...")
        notes_data = [
            {
                "note_id": "NOTE-001",
                "entity_id": "P-001",
                "author": "Officer Vikram",
                "role": "INVESTIGATOR",
                "text": "Ahmed Khan travel patterns match gold delivery cycles. UAE entry stamps correlate with Mumbai hawala peaks.",
            },
            {
                "note_id": "NOTE-002",
                "entity_id": "P-002",
                "author": "Priya Patel",
                "role": "ANALYST",
                "text": "Phone number +919820098200 flagged in 3 previous customs inquiries. Cash courier link suspected.",
            },
        ]

        for nd in notes_data:
            existing_n = db.query(NoteDB).filter(
                NoteDB.case_id == "case-001",
                NoteDB.note_id == nd["note_id"],
            ).first()
            if not existing_n:
                db.add(NoteDB(
                    note_id=nd["note_id"],
                    case_id="case-001",
                    entity_id=nd["entity_id"],
                    author=nd["author"],
                    role=nd["role"],
                    note_text=nd["text"],
                    timestamp=now_str,
                ))

        db.commit()

        # ---------------------------------------------------------
        # 10. Record Cryptographic Baseline Audit Log
        # ---------------------------------------------------------
        print("Establishing cryptographic audit log chain...")
        if db.query(AuditLogDB).count() == 0:
            record_audit(
                actor_name="System Provisioner",
                action="system_seed",
                details="Initial provisioning of Operation Falcon Shadow, system roles, permissions, and demo intelligence.",
                case_id="case-001",
                actor_id="USR-SADMIN-01",
                actor_role="SUPER_ADMIN",
            )

        print("\nSeed completed successfully!")
        print("==================================================================")
        print("  DEMO CREDENTIALS (ROLE TESTING READY):")
        print("  - Super Admin : superadmin   / SuperAdmin123!")
        print("  - Admin       : admin        / Admin123!")
        print("  - Investigator: investigator / Investigator123!")
        print("  - Analyst     : analyst      / Analyst123!")
        print("  - Reviewer    : reviewer     / Reviewer123!")
        print("  - Viewer      : viewer       / Viewer123!")
        print("  DEFAULT CASE  : case-001 (Operation Falcon Shadow)")
        print("==================================================================\n")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
