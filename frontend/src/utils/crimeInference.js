/**
 * Crime Inference Helper & Fallback Engine for NetTrace Frontend
 * Provides color mapping, legal statutes, severity styling, and fallback inference.
 */

export const CRIME_SEVERITY_STYLES = {
  Critical: {
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    card: 'bg-rose-950/30 border-rose-500/30 text-rose-200',
    accent: 'text-rose-400',
    dot: 'bg-rose-500',
  },
  High: {
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    card: 'bg-amber-950/30 border-amber-500/30 text-amber-200',
    accent: 'text-amber-400',
    dot: 'bg-amber-500',
  },
  Moderate: {
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    card: 'bg-sky-950/30 border-sky-500/30 text-sky-200',
    accent: 'text-sky-400',
    dot: 'bg-sky-500',
  },
  Informational: {
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    card: 'bg-slate-900/30 border-slate-700/40 text-slate-300',
    accent: 'text-slate-400',
    dot: 'bg-slate-400',
  },
};

export function getSeverityStyle(severity) {
  const key = (severity || 'Moderate').trim();
  return CRIME_SEVERITY_STYLES[key] || CRIME_SEVERITY_STYLES.Moderate;
}

/**
 * Fallback crime inference if the link object does not already have backend pre-computed crime data.
 */
export function inferCrimeFallback(linkOrRel) {
  if (!linkOrRel) return null;

  // If already populated from backend
  if (linkOrRel.suspected_crime) {
    return {
      suspected_crime: linkOrRel.suspected_crime,
      crime_category: linkOrRel.crime_category || 'Suspected Offense',
      legal_statutes: linkOrRel.legal_statutes || [],
      crime_severity: linkOrRel.crime_severity || 'Moderate',
      crime_rationale: linkOrRel.crime_rationale || '',
      actionable_recommendations: linkOrRel.actionable_recommendations || [],
      indictment_readiness: linkOrRel.indictment_readiness || 'Preliminary',
    };
  }

  const relType = (linkOrRel.relation_type || linkOrRel.type || '').toUpperCase();
  const evidenceStr = Array.isArray(linkOrRel.evidence) ? linkOrRel.evidence.join(' ').toLowerCase() : (linkOrRel.evidence || '').toLowerCase();
  const attrs = linkOrRel.attributes || {};
  const method = (attrs.method || '').toLowerCase();

  if (relType.includes('FINANCIAL') || relType.includes('TRANSFERRED') || relType.includes('PAID') || method.includes('hawala') || evidenceStr.includes('hawala') || evidenceStr.includes('cash token')) {
    return {
      suspected_crime: 'Hawala Informal Value Transfer & Layering',
      crime_category: 'Money Laundering & Financial Crimes',
      legal_statutes: ['PMLA 2002 Sec 3 & 4', 'FEMA 1999 Sec 3', 'IPC 120B'],
      crime_severity: 'High',
      crime_rationale: 'Illicit transfer of funds bypassing banking channels to finance syndicate operations.',
      actionable_recommendations: [
        'Serve Section 50 PMLA summons on account operators and Hawala angadias.',
        'Obtain mirror imaging of Hawala ledger tokens and phone call records.',
      ],
      indictment_readiness: 'Prima Facie Established',
    };
  }

  if (relType.includes('CORRUPTED') || relType.includes('BRIBED') || evidenceStr.includes('bribe') || evidenceStr.includes('customs') || evidenceStr.includes('scanner')) {
    return {
      suspected_crime: 'Port Gate Customs Scanner Subversion & Public Servant Bribery',
      crime_category: 'Bribery & Public Corruption',
      legal_statutes: ['Prevention of Corruption Act 1988 Sec 7 & 12', 'Customs Act 1962 Sec 132 & 135'],
      crime_severity: 'Critical',
      crime_rationale: 'Active bribery to circumvent regulatory border scrutiny for contraband entry.',
      actionable_recommendations: [
        'Request Vigilance Directorate sanction for prosecution.',
        'Seize container manifest logs and gate sensor audit timestamps.',
      ],
      indictment_readiness: 'High Probability',
    };
  }

  if (relType.includes('COMMUNICATED') || relType.includes('CALLED') || relType.includes('MESSAGED') || evidenceStr.includes('voip') || evidenceStr.includes('burner')) {
    return {
      suspected_crime: 'Clandestine Operational Telecom & Conspiracy Coordination',
      crime_category: 'Criminal Conspiracy',
      legal_statutes: ['IPC 120B (Criminal Conspiracy)', 'Indian Telegraph Act Sec 25', 'IT Act Sec 69'],
      crime_severity: 'Moderate',
      crime_rationale: 'Coordination between co-conspirators using evasive telecom vectors.',
      actionable_recommendations: [
        'Issue Section 91 CrPC notice to telecom provider for CDR and cell tower triangulation.',
        'Forensically extract device handset logs and messaging apps.',
      ],
      indictment_readiness: 'Corroboration Required',
    };
  }

  if (relType.includes('TRANSPORTED') || relType.includes('CONVOY') || evidenceStr.includes('transit') || evidenceStr.includes('vehicle')) {
    return {
      suspected_crime: 'Illicit Contraband Transport & Armed Escort Transit',
      crime_category: 'Smuggling & Contraband Trafficking',
      legal_statutes: ['Customs Act 1962 Sec 115 & 135', 'IPC 120B / 34'],
      crime_severity: 'High',
      crime_rationale: 'Concealed logistical transit of illegal consignment across jurisdictional highways.',
      actionable_recommendations: [
        'Impound transit vehicles under Section 115 Customs Act.',
        'Subpoena toll plaza FASTag tracking and CCTV camera feeds.',
      ],
      indictment_readiness: 'High Probability',
    };
  }

  return {
    suspected_crime: `Suspected Associational Nexus (${relType || 'CONSPIRACY'})`,
    crime_category: 'Criminal Conspiracy & Syndicate Nexus',
    legal_statutes: ['IPC 120B (Criminal Conspiracy)', 'IPC 34 (Common Intention)'],
    crime_severity: 'Moderate',
    crime_rationale: 'Documented associational link between entities indicating coordinated criminal enterprise.',
    actionable_recommendations: [
      'Cross-reference link against national crime database indices.',
      'Corroborate timeline overlap with major syndicate operations.',
    ],
    indictment_readiness: 'Preliminary',
  };
}
