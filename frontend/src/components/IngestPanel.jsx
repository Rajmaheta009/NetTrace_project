import React, { useState } from 'react';
import { 
  UploadCloud, 
  FileCode, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ArrowRight, 
  Sparkles,
  Play,
  RotateCcw
} from 'lucide-react';
import { importText, importFile } from '../services/api';

export default function IngestPanel({ onIngestSuccess }) {
  const [activeMode, setActiveMode] = useState('text'); // 'text' | 'file' | 'presets'
  const [textContent, setTextContent] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Quick Demo Presets - 4 Comprehensive Multi-Vector Datasets
  const demoPresets = [
    {
      title: '📊 01. Structured Syndicate Case (CSV)',
      type: 'csv',
      label: '01_structured_syndicate.csv',
      snippet: `record_type,id,type,name,source,target,relation_type,event_id,evidence,role,phone,plate,model,facility_type,security,category,jurisdiction,amount,duration,tower,carrier,method,timestamp
entity,p101,Person,Vikram 'Ghost' Singhania,,,,,,Kingpin & Strategic Broker,+91-98765-43210,,,,,,Syndicate Mastermind,International,,,,,
entity,p102,Person,Rajesh Shrestha,,,,,,Hawala Mastermind & Conduit,+971-50-1122334,,,,,,Offshore Banker,UAE-India,,,,,
entity,p103,Person,Anita Rao,,,,,,Corporate Comptroller & Auditor,+91-91234-56789,,,,,,Financial Controller,Mumbai,,,,,
entity,p104,Person,Sanjay 'Kabir' Patel,,,,,,Narcotics Logistics Lead,+91-98765-43210,,,,,,Operations Chief,Gujarat-Maharashtra,,,,,
entity,p105,Person,Imran 'Chhota' Khan,,,,,,Chief Field Enforcer,+91-98765-00111,,,,,,Tactical Squad Lead,Mumbai,,,,,
entity,p106,Person,Tariq Mansoor,,,,,,Safehouse Custodian & Driver,+91-98765-00222,,,,,,Logistics Courier,Thane,,,,,
entity,p107,Person,Devendra 'Dev' Joshi,,,,,,Port Customs Facilitator,+91-98200-11223,,,,,,Customs Insider,Nhava Sheva,,,,,
entity,p108,Person,Zubair Ahmed,,,,,,Hawala Cash Courier,+91-98333-77889,,,,,,Cash Runner,South Mumbai,,,,,
entity,org101,Organization,Al-Zahra Global Trading LLC,,,,,,,,,,,,Hawala Clearing Front,Dubai / UAE,,,,,
entity,org102,Organization,Coastal Shipping & Maritime Logistics,,,,,,,,,,,,Maritime Smuggling Conduit,Panama Registry,,,,,
entity,org103,Organization,Apex Bullion & Precious Metals FZE,,,,,,,,,,,,Precious Metals Layering,Sharjah Free Zone,,,,,
entity,org104,Organization,Silverline Import Export Pvt Ltd,,,,,,,,,,,,Domestic Hawala Front,Mumbai India,,,,,
entity,v101,Vehicle,MH-01-CZ-9999,,,,,,,,,MH-01-CZ-9999,Black Armored Fortuner,,,,,,,,
entity,v102,Vehicle,MH-04-AB-1234,,,,,,,,,MH-04-AB-1234,Grey Scorpio 4x4,,,,,,,,
entity,v103,Vehicle,GJ-01-XX-5500,,,,,,,,,GJ-01-XX-5500,Eicher Heavy Cargo Truck,,,,,,,,
entity,loc101,Location,Dock 14 Nhava Sheva Port,,,,,,,,,,,Container Freight Station,Port Facility Perimeter,,,,,,,
entity,loc102,Location,Penthouse 7B Bandra West,,,,,,,,,,,Executive Clandestine Safehouse,Biometric Access & CCTV,,,,,,,
entity,loc103,Location,Cafe Coastal Marine Drive Mumbai,,,,,,,,,,,Covert Meeting Cabin,Field Surveillance Cameras,,,,,,,
entity,loc104,Location,Warehouse 3A Bhiwandi Logistics Hub,,,,,,,,,,,Contraband Storage Depot,Industrial CCTV & Guards,,,,,,,
entity,ph101,PhoneNumber,+91-98765-43210,,,,,,,,+91-98765-43210,,,,,,,,Airtel Satellite Encrypted,
entity,ph102,PhoneNumber,+971-50-1122334,,,,,,,,+971-50-1122334,,,,,,,,Etisalat VoIP Gateway,
entity,ph103,PhoneNumber,+91-91234-56789,,,,,,,,+91-91234-56789,,,,,,,,Jio Corporate Secure,
relationship,,p101,p102,KNOWS,ev_wire_01,Encrypted wiretap recorded Vikram directing Rajesh on hawala transfer,,,,,,,,,,,,,,2026-03-12 09:15
relationship,,p102,org101,MEMBER_OF,ev_corp_101,Corporate registrar documents Rajesh Shrestha as Managing Partner of Al-Zahra Trading,,,,,,,,,,,,,,2026-01-10 10:00
relationship,,p103,org101,MEMBER_OF,ev_corp_102,Anita Rao designated as primary signatory and shell auditor for Al-Zahra Global Trading,,,,,,,,,,,,,,2026-01-12 11:30
relationship,,p102,p103,KNOWS,ev_audit_01,Financial audits confirm Rajesh and Anita coordinate layered banking accounts,,,,,,,,,,,,,,2026-02-14 16:20
relationship,,p101,p104,KNOWS,ev_wire_01,Vikram instructs Sanjay on maritime cargo arrival timeline at Nhava Sheva,,,,,,,,,,,,,,2026-03-12 09:45
relationship,,p101,loc102,LOCATED_AT,ev_raid_prep,Physical surveillance logged Vikram entering Penthouse 7B Bandra West,,,,,,,,,,,,,,2026-03-14 21:00
relationship,,p102,loc102,LOCATED_AT,ev_raid_prep,Rajesh observed meeting inside Penthouse 7B Bandra West,,,,,,,,,,,,,,2026-03-14 21:15
relationship,,p104,p105,KNOWS,ev_enforce_01,Sanjay dispatches Imran for armed perimeter security at Bhiwandi depot,,,,,,,,,,,,,,2026-03-13 14:00
relationship,,p104,p106,KNOWS,ev_cargo_drop,Sanjay coordinates transport run with Tariq for container offload,,,,,,,,,,,,,,2026-03-13 18:30
relationship,,p105,p106,KNOWS,ev_cargo_drop,Imran and Tariq confirmed on-site during heavy container transfer,,,,,,,,,,,,,,2026-03-13 19:15
relationship,,p104,v101,OWNS_VEHICLE,ev_anpr_01,ANPR traffic camera recorded Sanjay operating Black Fortuner MH-01-CZ-9999,,,,,,,,,,,,,,2026-03-11 08:30
relationship,,p105,v101,OWNS_VEHICLE,ev_anpr_02,ANPR camera recorded Imran operating same Black Fortuner MH-01-CZ-9999 at toll plaza,,,,,,,,,,,,,,2026-03-12 16:45
relationship,,p105,v102,OWNS_VEHICLE,ev_escort_01,Imran registered owner of Grey Scorpio MH-04-AB-1234 used as convoy escort,,,,,,,,,,,,,,2026-03-10 12:00
relationship,,p106,v103,OWNS_VEHICLE,ev_truck_01,Tariq observed driving heavy freight truck GJ-01-XX-5500 from port terminal,,,,,,,,,,,,,,2026-03-13 22:15
relationship,,p104,loc101,MET_AT,ev_dock_inspect,Sanjay visited Dock 14 container terminal under false cargo manifest,,,,,,,,,,,,,,2026-03-13 17:00
relationship,,p107,loc101,LOCATED_AT,ev_customs_clear,Devendra Joshi manages customs inspection bays at Dock 14 Nhava Sheva,,,,,,,,,,,,,,2026-03-13 16:30
relationship,,p104,p107,KNOWS,ev_bribe_clear,Intercepted communications show Sanjay bribing Devendra Joshi to bypass scanner gate,,,,,,,,,,,,,,2026-03-13 17:45
relationship,,org102,loc101,LOCATED_AT,ev_dock_lease,Coastal Shipping holds long-term maritime berth lease at Dock 14 Nhava Sheva,,,,,,,,,,,,,,2026-01-05 09:00
relationship,,p101,loc103,MET_AT,ev_covert_meet,Vikram and Sanjay held sit-down discussion inside VIP cabin Cafe Coastal Marine Drive,,,,,,,,,,,,,,2026-03-08 19:30
relationship,,p104,loc103,MET_AT,ev_covert_meet,Sanjay documented arriving at Cafe Coastal Marine Drive for syndicate strategy brief,,,,,,,,,,,,,,2026-03-08 19:35
relationship,,p106,loc104,LOCATED_AT,ev_warehouse_drop,Tariq delivered palletized narcotics consignments to Bhiwandi Warehouse 3A,,,,,,,,,,,,,,2026-03-14 02:30
relationship,,p105,loc104,LOCATED_AT,ev_warehouse_drop,Imran provided armed perimeter watch during Bhiwandi Warehouse 3A unloading,,,,,,,,,,,,,,2026-03-14 02:45
relationship,,p102,p108,ASSOCIATED_WITH,ev_hawala_drop,Rajesh issued Hawala token chit #HWL-9921 to Zubair for cash collection,,,,,,,,,,,₹ 12.5 Cr,,,,Hawala Token Chit,2026-03-14 11:00
relationship,,p108,org104,ASSOCIATED_WITH,ev_cash_mule,Zubair deposited Hawala cash consignments into Silverline Import Export accounts,,,,,,,,,,,₹ 7.8 Cr,,,,Commercial Banking,2026-03-14 14:30
relationship,,p102,org103,ASSOCIATED_WITH,ev_bullion_trade,Rajesh wired offshore funds to Apex Bullion FZE for gold bullion layering,,,,,,,,,,,₹ 18.2 Cr,,,,SWIFT / Hawala,2026-03-15 10:15
relationship,,p101,p104,CALLED,ev_wire_01,Encrypted voice call between Vikram and Sanjay regarding consignment status,,,,,,,,,,,,14m 20s,BTS-South-Mumbai-04,Airtel 5G Encrypted,,2026-03-12 10:15
relationship,,p104,p105,CALLED,ev_call_02,CDR logged urgent coordination call between Sanjay and Imran,,,,,,,,,,,,4m 45s,BTS-NhavaSheva-Port-02,Jio LTE,,2026-03-12 11:30
relationship,,p104,p106,CALLED,ev_call_03,CDR logged logistics dispatch call from Sanjay to driver Tariq,,,,,,,,,,,,6m 10s,BTS-Bhiwandi-East-01,Vodafone-Idea,,2026-03-12 12:40
relationship,,p105,p106,CALLED,ev_call_04,CDR logged tactical security ping between Imran and Tariq,,,,,,,,,,,,3m 15s,BTS-Bandra-West-03,Jio LTE,,2026-03-12 14:05`
    },
    {
      title: '🕸️ 02. Semi-Structured Syndicate Network (JSON)',
      type: 'json',
      label: '02_semistructured_network.json',
      snippet: JSON.stringify({
        "case_code": "OP-BLACK-LOTUS-V2",
        "entities": [
          {"id": "p201", "type": "Person", "name": "Vikram 'Ghost' Singhania", "aliases": ["Ghost", "VK"], "attributes": {"role": "Kingpin & Broker", "phone": "+91-98765-43210", "imei": "354928091234567"}},
          {"id": "p202", "type": "Person", "name": "Rajesh Shrestha", "aliases": ["The Banker"], "attributes": {"role": "Hawala Mastermind", "phone": "+971-50-1122334", "imei": "864192041239845"}},
          {"id": "p203", "type": "Person", "name": "Anita Rao", "aliases": ["Comptroller"], "attributes": {"role": "Shell Auditor", "phone": "+91-91234-56789", "imei": "359012051284711"}},
          {"id": "p204", "type": "Person", "name": "Sanjay 'Kabir' Patel", "aliases": ["Operations Chief"], "attributes": {"role": "Narcotics Lead", "phone": "+91-98765-43210", "imei": "354928091234567"}},
          {"id": "p205", "type": "Person", "name": "Imran 'Chhota' Khan", "aliases": ["Enforcer"], "attributes": {"role": "Tactical Lead", "phone": "+91-98765-00111"}},
          {"id": "p206", "type": "Person", "name": "Tariq Mansoor", "aliases": ["Transporter"], "attributes": {"role": "Safehouse Custodian", "phone": "+91-98765-00222"}},
          {"id": "p207", "type": "Person", "name": "Devendra 'Dev' Joshi", "attributes": {"role": "Customs Facilitator", "phone": "+91-98200-11223"}},
          {"id": "p208", "type": "Person", "name": "Zubair Ahmed", "attributes": {"role": "Hawala Courier", "phone": "+91-98333-77889"}},
          {"id": "org201", "type": "Organization", "name": "Al-Zahra Global Trading LLC", "attributes": {"category": "Hawala Clearing Front", "jurisdiction": "Dubai / UAE"}},
          {"id": "org202", "type": "Organization", "name": "Coastal Shipping & Maritime Logistics", "attributes": {"category": "Maritime Smuggling", "jurisdiction": "Panama"}},
          {"id": "org203", "type": "Organization", "name": "Apex Bullion & Precious Metals FZE", "attributes": {"category": "Precious Metals Layering", "jurisdiction": "Sharjah"}},
          {"id": "org204", "type": "Organization", "name": "Silverline Import Export Pvt Ltd", "attributes": {"category": "Domestic Hawala Front", "jurisdiction": "Mumbai"}},
          {"id": "v201", "type": "Vehicle", "name": "MH-01-CZ-9999", "attributes": {"model": "Black Fortuner"}},
          {"id": "v202", "type": "Vehicle", "name": "MH-04-AB-1234", "attributes": {"model": "Grey Scorpio"}},
          {"id": "v203", "type": "Vehicle", "name": "GJ-01-XX-5500", "attributes": {"model": "Eicher Heavy Freight"}},
          {"id": "loc201", "type": "Location", "name": "Dock 14 Nhava Sheva Port", "attributes": {"facility_type": "Container Freight Station", "security": "Access Gate 3"}},
          {"id": "loc202", "type": "Location", "name": "Penthouse 7B Bandra West", "attributes": {"facility_type": "Executive Safehouse", "security": "Biometric & CCTV"}},
          {"id": "loc203", "type": "Location", "name": "Cafe Coastal Marine Drive Mumbai", "attributes": {"facility_type": "Covert Meeting Site"}},
          {"id": "loc204", "type": "Location", "name": "Warehouse 3A Bhiwandi Logistics Hub", "attributes": {"facility_type": "Contraband Depot", "security": "Industrial CCTV"}}
        ],
        "relationships": [
          {"source": "p201", "target": "p202", "relation_type": "KNOWS", "event_id": "ev_wire_01", "attributes": {"amount": "₹ 19.95 Cr", "method": "Hawala Settlement"}},
          {"source": "p202", "target": "org201", "relation_type": "MEMBER_OF", "event_id": "ev_corp_201"},
          {"source": "p203", "target": "org201", "relation_type": "MEMBER_OF", "event_id": "ev_corp_202"},
          {"source": "p202", "target": "p203", "relation_type": "KNOWS", "event_id": "ev_audit_201", "attributes": {"amount": "₹ 11.2 Cr"}},
          {"source": "p201", "target": "p204", "relation_type": "KNOWS", "event_id": "ev_wire_01"},
          {"source": "p201", "target": "loc202", "relation_type": "LOCATED_AT", "event_id": "ev_safehouse_raid"},
          {"source": "p202", "target": "loc202", "relation_type": "LOCATED_AT", "event_id": "ev_safehouse_raid"},
          {"source": "p204", "target": "p205", "relation_type": "KNOWS", "event_id": "ev_enforce_201"},
          {"source": "p204", "target": "p206", "relation_type": "KNOWS", "event_id": "ev_cargo_drop"},
          {"source": "p205", "target": "p206", "relation_type": "KNOWS", "event_id": "ev_cargo_drop"},
          {"source": "p204", "target": "v201", "relation_type": "OWNS_VEHICLE", "event_id": "ev_anpr_201"},
          {"source": "p205", "target": "v201", "relation_type": "OWNS_VEHICLE", "event_id": "ev_anpr_202"},
          {"source": "p205", "target": "v202", "relation_type": "OWNS_VEHICLE", "event_id": "ev_escort_201"},
          {"source": "p206", "target": "v203", "relation_type": "OWNS_VEHICLE", "event_id": "ev_truck_201"},
          {"source": "p204", "target": "loc201", "relation_type": "MET_AT", "event_id": "ev_dock_inspect"},
          {"source": "p207", "target": "loc201", "relation_type": "LOCATED_AT", "event_id": "ev_customs_clear"},
          {"source": "p204", "target": "p207", "relation_type": "KNOWS", "event_id": "ev_bribe_clear", "attributes": {"amount": "₹ 50 Lakhs", "method": "Cash Bribery"}},
          {"source": "org202", "target": "loc201", "relation_type": "LOCATED_AT", "event_id": "ev_dock_lease"},
          {"source": "p201", "target": "loc203", "relation_type": "MET_AT", "event_id": "ev_covert_meet"},
          {"source": "p204", "target": "loc203", "relation_type": "MET_AT", "event_id": "ev_covert_meet"},
          {"source": "p206", "target": "loc204", "relation_type": "LOCATED_AT", "event_id": "ev_warehouse_drop"},
          {"source": "p205", "target": "loc204", "relation_type": "LOCATED_AT", "event_id": "ev_warehouse_drop"},
          {"source": "p202", "target": "p208", "relation_type": "ASSOCIATED_WITH", "event_id": "ev_hawala_drop", "attributes": {"amount": "₹ 12.5 Cr", "method": "Hawala Token Chit"}},
          {"source": "p208", "target": "org204", "relation_type": "ASSOCIATED_WITH", "event_id": "ev_cash_mule", "attributes": {"amount": "₹ 7.8 Cr", "method": "Bank Deposit"}},
          {"source": "p202", "target": "org203", "relation_type": "ASSOCIATED_WITH", "event_id": "ev_bullion_trade", "attributes": {"amount": "₹ 18.2 Cr", "method": "Bullion Layering"}},
          {"source": "p201", "target": "p204", "relation_type": "CALLED", "event_id": "ev_wire_01", "attributes": {"duration": "14m 20s", "tower": "BTS-South-Mumbai-04", "carrier": "Airtel 5G"}},
          {"source": "p204", "target": "p205", "relation_type": "CALLED", "event_id": "ev_call_02", "attributes": {"duration": "4m 45s", "tower": "BTS-NhavaSheva-Port-02", "carrier": "Jio LTE"}},
          {"source": "p204", "target": "p206", "relation_type": "CALLED", "event_id": "ev_call_03", "attributes": {"duration": "6m 10s", "tower": "BTS-Bhiwandi-East-01", "carrier": "Vodafone-Idea"}},
          {"source": "p205", "target": "p206", "relation_type": "CALLED", "event_id": "ev_call_04", "attributes": {"duration": "3m 15s", "tower": "BTS-Bandra-West-03", "carrier": "Jio LTE"}}
        ]
      }, null, 2)
    },
    {
      title: '📄 03. Unstructured Case Report (TXT)',
      type: 'text',
      label: '03_unstructured_case_report.txt',
      snippet: `INVESTIGATIVE INTELLIGENCE REPORT
OPERATION: FALCON SHADOW // CROSS-BORDER SYNDICATE INVESTIGATION
SECURITY CLASSIFICATION: TOP SECRET

Surveillance teams established that Kingpin Vikram 'Ghost' Singhania serves as the strategic broker commanding an extensive transnational crime network across Western India and UAE. Intercepts confirm Vikram Singhania operates using secure satellite line +91-98765-43210. Vikram Singhania directs offshore banking through hawala controller Rajesh Shrestha (+971-50-1122334), who manages shell entity Al-Zahra Global Trading LLC.

Corporate audits reveal Anita Rao acts as nominee comptroller for Al-Zahra Global Trading LLC (+91-91234-56789). Under Rajesh Shrestha instructions, Anita Rao transferred ₹ 18.2 Crore through Apex Bullion & Precious Metals FZE. Courier Zubair Ahmed received Hawala token chits valued at ₹ 12.5 Crore from Rajesh Shrestha, laundering ₹ 7.8 Crore into Silverline Import Export Pvt Ltd.

Operations chief Sanjay 'Kabir' Patel (+91-98765-43210) oversaw maritime contraband arrivals at Dock 14 Nhava Sheva Port, leased by Coastal Shipping & Maritime Logistics. Sanjay Patel met corrupt customs officer Devendra 'Dev' Joshi (+98200-11223), paying a ₹ 50 Lakhs cash bribe to bypass the container scanner.

Sanjay Patel, chief enforcer Imran 'Chhota' Khan (+91-98765-00111), and driver Tariq Mansoor (+91-98765-00222) form a tight operational cell. ANPR cameras flagged severe shared-vehicle anomalies: both Sanjay Patel and Imran Khan drive Black Armored Fortuner MH-01-CZ-9999. Imran Khan also drives Grey Scorpio MH-04-AB-1234 escorting freight truck GJ-01-XX-5500 driven by Tariq Mansoor.

Vikram Singhania held executive meetings with Sanjay Patel at Cafe Coastal Marine Drive Mumbai and with Rajesh Shrestha at Penthouse 7B Bandra West. Tariq Mansoor delivered contraband to Warehouse 3A Bhiwandi Logistics Hub under armed watch by Imran Khan.`
    },
    {
      title: '📡 04. Tactical Intercepts Multi-Vector (LOG)',
      type: 'text',
      label: '04_multivector_intercepts.log',
      snippet: `# =====================================================================
# TACTICAL INTERCEPT LOG - TASK FORCE NETTRACE (ANPR, CDR, HAWALA)
# =====================================================================

[ANPR_CAMERA_04] [LOCATION: Sea-Link-South-Toll]
VEHICLE_PLATE: MH-01-CZ-9999
MAKE_MODEL: Black Armored Fortuner
DRIVER_IDENTIFIED: Sanjay 'Kabir' Patel
CO_PASSENGER: Vikram 'Ghost' Singhania

[WIRETAP_AUDIO_INTERCEPT] [CIRCUIT: SAT-9901-ENC]
CALLER: Vikram 'Ghost' Singhania (+91-98765-43210)
RECEIVER: Rajesh Shrestha (+971-50-1122334)
TOWER_SECTOR: BTS-South-Mumbai-04
DURATION: 14m 20s
TRANSCRIPT_EXCERPT: "Wire the ₹ 19.95 Cr hawala settlement clearance through Al-Zahra Global Trading LLC."
EVENT_ID: ev_wire_01

[CDR_TELECOM_LOG] [CARRIER: Jio LTE]
CALLER_SUSPECT: Sanjay 'Kabir' Patel (+91-98765-43210)
RECEIVER_SUSPECT: Imran 'Chhota' Khan (+91-98765-00111)
CALL_DURATION: 4m 45s
BTS_CELL_TOWER: BTS-NhavaSheva-Port-02
SUMMARY: Sanjay instructs Imran to mobilize armed escort Scorpio MH-04-AB-1234.

[ANPR_CAMERA_12] [LOCATION: Airoli-Toll-Plaza]
VEHICLE_PLATE: MH-01-CZ-9999
DRIVER_IDENTIFIED: Imran 'Chhota' Khan
PREVIOUS_OPERATOR: Sanjay 'Kabir' Patel
ANOMALY_FLAG: SHARED_VEHICLE_RESOURCE_DETECTED
EVENT_ID: ev_anpr_02

[FINANCIAL_INTELLIGENCE_UNIT] [CHIT_RECOVERY]
DOCUMENT_TYPE: Hawala Cash Chit #HWL-9921
REMITTER: Rajesh Shrestha (Al-Zahra Global Trading LLC)
COURIER_MULE: Zubair Ahmed
BENEFICIARY_ENTITY: Silverline Import Export Pvt Ltd
AMOUNT: ₹ 12.5 Cr
EVENT_ID: ev_hawala_drop

[PHYSICAL_SURVEILLANCE_OP] [SECTOR: JNPT]
LOCATION: Dock 14 Nhava Sheva Port
SUSPECT_OBSERVED: Devendra 'Dev' Joshi (Customs Appraiser)
FACILITY_LEASEHOLDER: Coastal Shipping & Maritime Logistics
INCIDENT: Sanjay 'Kabir' Patel arrived on site and passed bribe envelope to Devendra Joshi.

[PORT_GATE_DISPATCH] [SECTOR: JNPT-OUTBOUND]
CARGO_TRUCK: GJ-01-XX-5500 (Eicher Heavy Freight)
DRIVER: Tariq Mansoor (+91-98765-00222)
ESCORT_VEHICLE: MH-04-AB-1234 (Imran 'Chhota' Khan)
DESTINATION_SITE: Warehouse 3A Bhiwandi Logistics Hub
EVENT_ID: ev_cargo_drop`
    }
  ];


  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!textContent.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await importText(textContent, null, sourceLabel || 'direct_paste');
      setResult(res);
      onIngestSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await importFile(file, sourceLabel || file.name);
      setResult(res);
      onIngestSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPreset = async (preset) => {
    setTextContent(preset.snippet);
    setSourceLabel(preset.label);
    setActiveMode('text');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Mode Switcher */}
      <div className="flex space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveMode('text')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeMode === 'text'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Paste Text / Raw Report</span>
        </button>
        <button
          onClick={() => setActiveMode('file')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeMode === 'file'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload File (.csv, .json, .txt)</span>
        </button>
        <button
          onClick={() => setActiveMode('presets')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeMode === 'presets'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Demo Case Datasets</span>
        </button>
      </div>

      {/* Mode 1: Paste Text */}
      {activeMode === 'text' && (
        <form onSubmit={handleTextSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Source Tag / Case Label (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Case_2026_09, Wiretap_Log_01"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-300">
                Investigation Content (CSV, JSON, or Plain Narrative Text)
              </label>
              <span className="text-[10px] text-cyan-400 font-mono">Auto-Triage Classifier Active</span>
            </div>
            <textarea
              rows={8}
              placeholder="Paste raw CSV rows (id,type,name...), structured JSON (entities, relationships), or an unstructured field agent surveillance report..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full bg-slate-950 text-xs text-slate-200 p-3 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 font-mono leading-relaxed"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !textContent.trim()}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'Classifying & Ingesting...' : 'Classify & Import Evidence'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Mode 2: Upload File */}
      {activeMode === 'file' && (
        <form onSubmit={handleFileSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Source Tag / Case Label (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. precinct_export_44"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              className="w-full bg-slate-950 text-xs text-slate-200 px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl p-8 text-center bg-slate-950/60 transition cursor-pointer">
            <input
              type="file"
              accept=".csv,.json,.txt,.log"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
              <UploadCloud className="w-10 h-10 text-cyan-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-200">
                {file ? file.name : 'Click or Drag & Drop investigation file'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Accepted formats: .csv, .json, .txt, .log (Max 15 MB)
              </p>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !file}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{loading ? 'Uploading & Extracting...' : 'Upload & Process File'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Mode 3: Presets */}
      {activeMode === 'presets' && (
        <div className="grid sm:grid-cols-2 gap-4">
          {demoPresets.map((preset, idx) => (
            <div 
              key={idx}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between space-y-3 hover:border-cyan-500/40 transition"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-100 text-xs sm:text-sm">{preset.title}</h4>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {preset.type}
                  </span>
                </div>
                <pre className="mt-2 text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-lg font-mono overflow-x-auto max-h-28 border border-slate-800/80">
                  {preset.snippet}
                </pre>
              </div>
              <button
                onClick={() => handleLoadPreset(preset)}
                className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Load into Editor</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center space-x-2 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <h4 className="font-bold text-sm">Ingestion Completed Successfully</h4>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Entities Imported</span>
              <span className="text-lg font-bold text-emerald-300">+{result.imported_entities}</span>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Relationships</span>
              <span className="text-lg font-bold text-emerald-300">+{result.imported_relationships}</span>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Total Graph Nodes</span>
              <span className="text-lg font-bold text-cyan-300">{result.node_count}</span>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Detected Format</span>
              <span className="text-xs font-bold text-amber-300 uppercase block mt-1">
                {result.detected_input_type || 'Structured'}
              </span>
            </div>
          </div>

          {result.warnings && result.warnings.length > 0 && (
            <div className="space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-[11px] text-amber-300/90 font-mono">
              <span className="font-bold uppercase text-[10px] text-amber-400 block mb-0.5">Notices & Warnings:</span>
              {result.warnings.map((w, idx) => (
                <p key={idx}>• {w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Card */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 shadow-xl space-y-2 text-xs text-rose-300">
          <div className="flex items-center space-x-2 text-rose-400 font-bold">
            <XCircle className="w-5 h-5" />
            <span>Ingestion Error</span>
          </div>
          <p className="font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            {error}
          </p>
        </div>
      )}

    </div>
  );
}
