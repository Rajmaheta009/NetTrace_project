"""
Module: Crime Inference Engine (app/crime_inference.py)

Deterministically analyzes graph relationships, co-occurring entities, roles,
verbatim evidence citations, attributes, and active case crime profiles to infer:
1. Suspected Criminal Offense / Activity Title
2. Crime Category / Domain
3. Applicable Statutory Violations & Legal Offenses (IPC, PMLA, NDPS, Customs Act, PCA, IT Act, etc.)
4. Crime Severity & Threat Classification (Critical, High, Medium, Low)
5. Evidence Rationale connecting the dots
6. Actionable Next Investigative Steps & Indictment Readiness
"""

from typing import Any, Dict, List, Optional
import re


def infer_crime_for_relationship(
    relation_type: str,
    source_entity: Any = None,
    target_entity: Any = None,
    evidence: Optional[List[str]] = None,
    attributes: Optional[Dict[str, Any]] = None,
    case_profile: str = "organized_crime",
) -> Dict[str, Any]:
    """
    Infers the specific crime indicated by a connection or relationship.
    Works seamlessly with Entity objects, dictionaries, or partial graph links.
    """
    evidence_list = evidence or []
    attrs = attributes or {}
    rel_type = (relation_type or "").upper().strip()

    def _extract_meta(ent):
        if ent is None:
            return {"type": "Unknown", "name": "", "role": "", "category": ""}
        if hasattr(ent, "type"):
            etype = ent.type.value if hasattr(ent.type, "value") else str(ent.type)
            name = getattr(ent, "name", "")
            e_attrs = getattr(ent, "attributes", {}) or {}
        elif isinstance(ent, dict):
            etype = ent.get("type", "Unknown")
            name = ent.get("name", "")
            e_attrs = ent.get("attributes", {}) or {}
        else:
            return {"type": "Unknown", "name": str(ent), "role": "", "category": ""}
        
        return {
            "type": str(etype),
            "name": str(name),
            "role": str(e_attrs.get("role", "")).lower(),
            "category": str(e_attrs.get("category", "")).lower(),
            "facility_type": str(e_attrs.get("facility_type", "")).lower(),
            "model": str(e_attrs.get("model", "")).lower(),
            "plate": str(e_attrs.get("plate", "")).lower(),
            "raw_attrs": e_attrs
        }

    src = _extract_meta(source_entity)
    tgt = _extract_meta(target_entity)

    corpus = " ".join([
        rel_type,
        src["name"], src["type"], src["role"], src["category"],
        tgt["name"], tgt["type"], tgt["role"], tgt["category"],
        " ".join(evidence_list),
        " ".join(f"{k} {v}" for k, v in attrs.items()),
        case_profile
    ]).lower()

    amount_str = attrs.get("amount") or ""
    if not amount_str:
        amt_match = re.search(r"(₹\s*[\d\.]+\s*(?:cr|crore|lakh|k)?|\$[\d\.]+[mkb]?)", corpus, re.I)
        if amt_match:
            amount_str = amt_match.group(1)

    # 1. BRIBERY & PUBLIC CORRUPTION AT PORTS / CHECKPOINTS
    if (
        re.search(r"(bribe|bribery|corrupt|customs officer|customs appraiser|scanner gate|bypass scanner|inspector bay|clearance envelope|kickback)", corpus)
        or ("customs" in corpus and ("bribe" in corpus or "bypass" in corpus or "scanner" in corpus))
        or (src["role"] in ("customs facilitator", "customs appraiser") or tgt["role"] in ("customs facilitator", "customs appraiser"))
    ):
        amt_clause = f" involving {amount_str}" if amount_str else ""
        return {
            "suspected_crime": "Public Corruption, Border Scanner Subversion & Port Gate Bribery",
            "crime_category": "Public Corruption & Border Subversion",
            "legal_statutes": [
                "Prevention of Corruption Act 1988 (Sec 7, 7A, 12 - Bribery of Public Servant)",
                "Customs Act 1962 (Sec 132 - False Declarations, Sec 135 - Evasion of Duty & Contraband Clearance)",
                "Indian Penal Code Sec 120B (Criminal Conspiracy) & Sec 165 (Public Servant Obtaining Valuable Thing)"
            ],
            "crime_severity": "Critical",
            "crime_rationale": (
                f"Documented illicit facilitation between {src['name']} and {tgt['name']}{amt_clause} "
                "to systematically subvert border security scanners and bypass mandatory customs physical inspection."
            ),
            "actionable_recommendations": [
                "Issue freeze summons under Prevention of Corruption Act Sec 18B",
                "Subpoena port container scanning bay bypass logs and supervisor audit trail",
                "Execute search and seizure on facilitator personal lockers and electronic communications"
            ],
            "indictment_readiness": "High"
        }

    # 2. HAWALA REMITTANCE, TOKEN CHITS & MONEY LAUNDERING
    if (
        re.search(r"(hawala|token chit|hwl-|chit|clearing front|cash runner|cash mule|layering|bullion layering|precious metals fze|swift / hawala)", corpus)
        or ("hawala" in corpus or ("wire" in corpus and ("crore" in corpus or "cr" in corpus)))
        or ("banker" in corpus and "launder" in corpus)
    ):
        amt_clause = f" totaling {amount_str}" if amount_str else ""
        return {
            "suspected_crime": "Unlawful Hawala Clearing Conduit & Trade-Based Money Laundering",
            "crime_category": "Financial Crime & Shadow Banking",
            "legal_statutes": [
                "Prevention of Money Laundering Act (PMLA) 2002 (Sec 3 - Offence of Money Laundering, Sec 4 - Punishment)",
                "Foreign Exchange Management Act (FEMA) 1999 (Sec 3 & 4 - Unauthorized Foreign Exchange Transactions)",
                "Indian Penal Code Sec 420 (Cheating) & Sec 120B (Criminal Conspiracy)"
            ],
            "crime_severity": "Critical",
            "crime_rationale": (
                f"Financial channeling link between {src['name']} and {tgt['name']}{amt_clause} "
                "utilizing unrecorded Hawala token settlements to launder proceeds of crime across commercial and offshore fronts."
            ),
            "actionable_recommendations": [
                "Transmit Financial Intelligence Unit (FIU-IND) Suspicious Transaction Report (STR)",
                "Apply for provisional attachment of beneficiary accounts under PMLA Sec 5",
                "Seize physical token ledger chits and cryptographically encrypted messaging devices"
            ],
            "indictment_readiness": "High"
        }

    # 3. NARCOTICS TRAFFICKING & CONTRABAND HAUL
    if (
        re.search(r"(narcotics|contraband|drugs|palletized|heroin|cocaine|meth|smuggling haul|consignment status|unloading|bhiwandi)", corpus)
        or case_profile == "narcotics_trafficking"
        or ("warehouse" in corpus and "drop" in corpus)
    ):
        return {
            "suspected_crime": "Commercial Contraband Narcotics Distribution & Depot Stashing",
            "crime_category": "Narcotics Trafficking (NDPS)",
            "legal_statutes": [
                "Narcotic Drugs and Psychotropic Substances (NDPS) Act 1985 (Sec 8(c) - Prohibition of Certain Operations)",
                "NDPS Act 1985 (Sec 21 & 22 - Commercial Quantity Offenses, Sec 29 - Criminal Conspiracy & Abetment)",
                "Customs Act 1962 (Sec 135 - Evasion of Duty and Smuggling)"
            ],
            "crime_severity": "Critical",
            "crime_rationale": (
                f"Operational contraband transfer corridor linking {src['name']} and {tgt['name']} "
                "for offloading and safeguarding commercial-quantity illicit consignments."
            ),
            "actionable_recommendations": [
                "Deploy tactical interception squad at transit choke points and warehousing perimeter",
                "Coordinate immediate chemical forensic field tests and chain-of-custody seal verification",
                "Issue red alert look-out circulars (LOC) for identified couriers and offload dispatchers"
            ],
            "indictment_readiness": "High"
        }

    # 4. ARMED CONVOY LOGISTICS & ANPR ESCORT VEHICLES
    if (
        rel_type == "OWNS_VEHICLE"
        or src["type"] == "Vehicle" or tgt["type"] == "Vehicle"
        or re.search(r"(anpr|escort|convoy|toll plaza|fortuner|scorpio|eicher|freight truck|armored|driver|shared vehicle)", corpus)
    ):
        return {
            "suspected_crime": "Tactical Contraband Convoy Escort & Fleet Asset Deployment",
            "crime_category": "Logistics & Tactical Movement",
            "legal_statutes": [
                "Customs Act 1962 (Sec 115 - Confiscation of Conveyances Used for Smuggling)",
                "Motor Vehicles Act 1988 (Sec 192A - Using Vehicle in Contravention of Law)",
                "Indian Penal Code Sec 34 (Acts Done by Several Persons in Furtherance of Common Intention)"
            ],
            "crime_severity": "High",
            "crime_rationale": (
                f"Logistical vehicular nexus connecting {src['name']} and {tgt['name']}, "
                "flagged by automated surveillance for convoy protection, cargo haulage, and shared transport concealment."
            ),
            "actionable_recommendations": [
                "Place FASTag and toll camera automated ANPR alerts across national highway corridors",
                "Impound flagged conveyances under Customs Act Sec 115 for forensic cabin swab analysis",
                "Subpoena regional transport office (RTO) ownership chain and nominee financing paperwork"
            ],
            "indictment_readiness": "Medium"
        }

    # 5. CORPORATE SHELL FRONTS & BENAMI ASSET SHIELDING
    if (
        rel_type == "MEMBER_OF"
        or src["type"] == "Organization" or tgt["type"] == "Organization"
        or re.search(r"(shell|nominee|comptroller|signatory|managing partner|front company|fze|llc|corporate registrar|board of directors)", corpus)
    ):
        return {
            "suspected_crime": "Benami Corporate Shell Formation & Fraudulent Nominee Shielding",
            "crime_category": "Corporate & Organized Fraud",
            "legal_statutes": [
                "Companies Act 2013 (Sec 447 - Punishment for Fraud, Sec 448 - False Statements)",
                "Prohibition of Benami Property Transactions Act 1988 (Sec 3 & 53 - Benami Transactions)",
                "Indian Penal Code Sec 468 (Forgery for Purpose of Cheating) & Sec 471 (Using Forged Document)"
            ],
            "crime_severity": "High",
            "crime_rationale": (
                f"Corporate structuring bond between {src['name']} and {tgt['name']} "
                "establishing nominee directorship, corporate veil concealment, and illicit commercial layering."
            ),
            "actionable_recommendations": [
                "Request Registrar of Companies (ROC) charter filings, beneficial ownership disclosures, and AGM logs",
                "Issue orders for lifting of corporate veil under Companies Act Sec 212 (SFIO investigation)",
                "Freeze authorized signatory banking authorizations and offshore trade invoices"
            ],
            "indictment_readiness": "High"
        }

    # 6. CLANDESTINE TELECOM CONSPIRACY & COMMAND CALLS
    if (
        rel_type == "CALLED"
        or src["type"] == "PhoneNumber" or tgt["type"] == "PhoneNumber"
        or re.search(r"(wiretap|cdr|bts|cell tower|encrypted voice|satellite|voip|duration|burner)", corpus)
    ):
        duration_info = attrs.get("duration", "")
        dur_clause = f" (Duration: {duration_info})" if duration_info else ""
        return {
            "suspected_crime": "Clandestine Command-and-Control Telecommunications Conspiracy",
            "crime_category": "Telecommunications & Conspiracy",
            "legal_statutes": [
                "Indian Telegraph Act 1885 (Sec 25 - Intentionally Damaging or Tampering with Telegraphs)",
                "Information Technology Act 2000 (Sec 69 - Power to Issue Directions for Interception)",
                "Indian Penal Code Sec 120B (Criminal Conspiracy - Mens Rea Communication Link)"
            ],
            "crime_severity": "High",
            "crime_rationale": (
                f"Direct telecommunications exchange between {src['name']} and {tgt['name']}{dur_clause} "
                "logged over encrypted or monitored infrastructure during active operational coordination windows."
            ),
            "actionable_recommendations": [
                "Obtain official Call Detail Records (CDR) and Subscriber Details Record (SDR) with tower coordinates",
                "Map correlated IMEI handset sharing and IMSI catcher logs for burner swapping detection",
                "Submit formal Section 91 CrPC notice to telecom service providers for voice transcript preservation"
            ],
            "indictment_readiness": "High"
        }

    # 7. SAFEHOUSE HARBORING & CLANDESTINE CONCLAVE
    if (
        rel_type in ("MET_AT", "LOCATED_AT")
        or src["type"] == "Location" or tgt["type"] == "Location"
        or re.search(r"(safehouse|penthouse|rendezvous|conclave|sit-down|hideout|harboring|perimeter)", corpus)
    ):
        return {
            "suspected_crime": "Criminal Conclave Meeting & Syndicate Safehouse Harboring",
            "crime_category": "Conspiracy & Fugitive Harboring",
            "legal_statutes": [
                "Indian Penal Code Sec 216 (Harbouring Offender Who Has Escaped from Custody or Whose Apprehension Has Been Ordered)",
                "Indian Penal Code Sec 120B (Criminal Conspiracy - Physical Conclave & Agreement)",
                "Unlawful Activities (Prevention) Act / Local Organized Crime Acts (if terror/gang designated)"
            ],
            "crime_severity": "High",
            "crime_rationale": (
                f"Physical co-presence or harboring liaison connecting {src['name']} and {tgt['name']} "
                "at a fortified or clandestine operations site to orchestrate syndicate objectives away from public view."
            ),
            "actionable_recommendations": [
                "Execute warrant-backed search and physical inspection of property lease deed agreements",
                "Retrieve internal biometric entry logs, private CCTV digital video recorder (DVR) hard disks",
                "Interview building security custodians and verify fictitious utility account registrations"
            ],
            "indictment_readiness": "Medium"
        }

    # 8. GENERAL SYNDICATE CONSORTIUM / KNOWS RELATION
    return {
        "suspected_crime": "Syndicate Enterprise Association & Common Intention Conspiracy",
        "crime_category": "Organized Crime & Racketeering",
        "legal_statutes": [
            "Indian Penal Code Sec 120B (Punishment of Criminal Conspiracy)",
            "Indian Penal Code Sec 34 (Acts Done by Several Persons in Furtherance of Common Intention)",
            "Maharashtra Control of Organised Crime Act (MCOCA) 1999 (Sec 3 - Continuing Unlawful Activity)"
        ],
        "crime_severity": "Moderate",
        "crime_rationale": (
            f"Documented association between {src['name']} ({src['type']}) and {tgt['name']} ({tgt['type']}) "
            f"under the active '{case_profile.replace('_', ' ').title()}' profile indicating active conspiratorial alignment."
        ),
        "actionable_recommendations": [
            "Cross-verify historical criminal dossier files and state intelligence gazettes",
            "Deploy covert reconnaissance on recurring co-location patterns",
            "Monitor secondary banking and asset registration conduits"
        ],
        "indictment_readiness": "Preliminary"
    }


def enrich_relationship_dict(rel_dict: Dict[str, Any], source_ent=None, target_ent=None, case_profile="organized_crime") -> Dict[str, Any]:
    """
    Enriches a relationship dictionary with inferred crime metadata.
    """
    crime_meta = infer_crime_for_relationship(
        relation_type=rel_dict.get("relation_type", ""),
        source_entity=source_ent,
        target_entity=target_ent,
        evidence=rel_dict.get("evidence", []),
        attributes=rel_dict.get("attributes", {}),
        case_profile=case_profile,
    )
    enriched = dict(rel_dict)
    enriched.update(crime_meta)
    return enriched
