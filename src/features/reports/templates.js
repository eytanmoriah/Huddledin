// Section Library + Template CRUD

// ─── Section Library ───
export const SECTION_LIBRARY = [
  // ── Universal ──
  {id:'reason_referral',title:'Reason for Referral',type:'freetext',specialty:'universal',fields:[{id:'text',label:'Reason for Referral',type:'textarea',placeholder:'Why was the child referred?'}]},
  {id:'background_history',title:'Background / Medical History',type:'freetext',specialty:'universal',fields:[{id:'text',label:'Medical & Developmental History',type:'textarea',placeholder:'Relevant medical, developmental, and family history...'}]},
  {id:'developmental_history',title:'Developmental History',type:'freetext',specialty:'universal',fields:[{id:'text',label:'Developmental History',type:'textarea',placeholder:'Milestones, developmental concerns...'}]},
  {id:'parent_concerns',title:'Parent/Caregiver Concerns',type:'freetext',specialty:'universal',fields:[{id:'text',label:'Parent Concerns',type:'textarea',placeholder:'What are the primary concerns reported by parents/caregivers?'}]},
  {id:'behavioral_observations',title:'Behavioral Observations',type:'freetext',specialty:'universal',fields:[{id:'text',label:'Observations',type:'textarea',placeholder:'Behavior, attention, engagement, cooperation during session...'}]},
  {id:'test_results',title:'Standardized Test Results',type:'structured',specialty:'universal',fields:[{id:'tests',label:'Test Results',type:'repeatable',subfields:[{id:'test_name',label:'Test Name',type:'text',placeholder:'e.g. CELF-5'},{id:'subtest',label:'Subtest',type:'text',placeholder:'e.g. Core Language'},{id:'score',label:'Standard Score',type:'text',placeholder:'e.g. 85'},{id:'percentile',label:'Percentile',type:'text',placeholder:'e.g. 16'},{id:'interpretation',label:'Interpretation',type:'dropdown',options:['Above Average','Average','Below Average','Significantly Below Average']}]}]},
  {id:'clinical_summary',title:'Clinical Summary / Impression',type:'freetext',specialty:'universal',fields:[{id:'text',label:'Clinical Impression',type:'textarea',placeholder:'Professional assessment summary...'}]},
  {id:'strengths',title:'Strengths',type:'freetext',specialty:'universal',fields:[{id:'text',label:'Strengths',type:'textarea',placeholder:'Areas of strength observed...'}]},
  {id:'areas_concern',title:'Areas of Concern',type:'freetext',specialty:'universal',fields:[{id:'text',label:'Areas of Concern',type:'textarea',placeholder:'Primary areas of concern...'}]},
  {id:'recommendations',title:'Recommendations',type:'mixed',specialty:'universal',fields:[{id:'therapy_rec',label:'Therapy Recommended',type:'dropdown',options:['Yes','No','Re-evaluation recommended']},{id:'frequency',label:'Frequency',type:'dropdown',options:['1x/week','2x/week','3x/week','Monthly','As needed']},{id:'duration',label:'Session Duration',type:'dropdown',options:['30 minutes','45 minutes','60 minutes']},{id:'notes',label:'Additional Recommendations',type:'textarea',placeholder:'Specific recommendations...'}]},
  {id:'goals',title:'Goals — Long-term & Short-term',type:'structured',specialty:'universal',fields:[{id:'goals_list',label:'Goals',type:'goals',placeholder:'Add therapy goal...'}]},
  {id:'home_program',title:'Home Program / Recommendations',type:'freetext',specialty:'universal',fields:[{id:'text',label:'Home Program',type:'textarea',placeholder:'Activities and strategies for parents/caregivers...'}]},
  {id:'next_steps',title:'Next Steps / Follow-up',type:'freetext',specialty:'universal',fields:[{id:'text',label:'Next Steps',type:'textarea',placeholder:'Follow-up plan, next session, re-evaluation timeline...'}]},

  // ── Speech-Language ──
  {id:'oral_motor',title:'Oral Motor Examination',type:'structured',specialty:'speech',fields:[{id:'structure',label:'Structure',type:'dropdown',options:['Within normal limits','Abnormalities noted']},{id:'function',label:'Function',type:'dropdown',options:['Within normal limits','Abnormalities noted']},{id:'notes',label:'Notes',type:'textarea',placeholder:'Details of oral motor findings...'}]},
  {id:'articulation',title:'Articulation / Phonology',type:'mixed',specialty:'speech',fields:[{id:'sounds_error',label:'Sounds in Error',type:'text',placeholder:'e.g. /r/, /s/, /l/ blends'},{id:'intelligibility',label:'Intelligibility (%)',type:'scale',min:0,max:100,step:5,defaultValue:80},{id:'context',label:'Context',type:'checklist',options:['Word level','Sentence level','Conversation']},{id:'notes',label:'Notes',type:'textarea',placeholder:'Additional observations...'}]},
  {id:'receptive_lang',title:'Receptive Language',type:'structured',specialty:'speech',fields:[{id:'test',label:'Test Used',type:'dropdown',options:['CELF-5','PLS-5','ROWPVT-4','PPVT-5','CELF Preschool-3','Other']},{id:'standard_score',label:'Standard Score',type:'text',placeholder:'e.g. 95'},{id:'percentile',label:'Percentile',type:'text',placeholder:'e.g. 37'},{id:'interpretation',label:'Interpretation',type:'dropdown',options:['Above Average','Average','Below Average','Significantly Below Average']},{id:'notes',label:'Notes',type:'textarea',placeholder:'Additional observations...'}]},
  {id:'expressive_lang',title:'Expressive Language',type:'structured',specialty:'speech',fields:[{id:'test',label:'Test Used',type:'dropdown',options:['CELF-5','PLS-5','EOWPVT-4','EVT-3','CELF Preschool-3','Other']},{id:'standard_score',label:'Standard Score',type:'text',placeholder:'e.g. 82'},{id:'percentile',label:'Percentile',type:'text',placeholder:'e.g. 12'},{id:'interpretation',label:'Interpretation',type:'dropdown',options:['Above Average','Average','Below Average','Significantly Below Average']},{id:'notes',label:'Notes',type:'textarea',placeholder:'Additional observations...'}]},
  {id:'fluency',title:'Fluency',type:'structured',specialty:'speech',fields:[{id:'rating',label:'Fluency',type:'dropdown',options:['Within normal limits','Mild disfluency','Moderate disfluency','Severe disfluency']},{id:'notes',label:'Notes',type:'textarea',placeholder:'Fluency observations...'}]},
  {id:'voice_resonance',title:'Voice / Resonance',type:'structured',specialty:'speech',fields:[{id:'rating',label:'Voice',type:'dropdown',options:['Within normal limits','Hoarse','Breathy','Nasal','Other']},{id:'notes',label:'Notes',type:'textarea',placeholder:'Voice observations...'}]},
  {id:'pragmatics',title:'Pragmatics / Social Communication',type:'freetext',specialty:'speech',fields:[{id:'text',label:'Observations',type:'textarea',placeholder:'Eye contact, turn-taking, topic maintenance...'}]},
  {id:'language_sample',title:'Language Sample Analysis',type:'freetext',specialty:'speech',fields:[{id:'text',label:'Language Sample',type:'textarea',placeholder:'MLU, sentence structure, vocabulary use...'}]},
  {id:'hearing_screening',title:'Hearing / Auditory Screening',type:'freetext',specialty:'speech',fields:[{id:'text',label:'Hearing Screening',type:'textarea',placeholder:'Hearing screening results and observations...'}]},
  {id:'feeding_swallowing',title:'Feeding / Swallowing',type:'freetext',specialty:'speech',fields:[{id:'text',label:'Feeding/Swallowing',type:'textarea',placeholder:'Feeding and swallowing observations...'}]},

  // ── Occupational Therapy ──
  {id:'fine_motor',title:'Fine Motor Skills',type:'mixed',specialty:'ot',fields:[{id:'grasp',label:'Grasp Pattern',type:'dropdown',options:['Age-appropriate','Immature','Atypical']},{id:'dominance',label:'Hand Dominance',type:'dropdown',options:['Right','Left','Ambidextrous','Not established']},{id:'manipulation',label:'Manipulation',type:'dropdown',options:['Within normal limits','Mild difficulty','Moderate difficulty','Significant difficulty']},{id:'notes',label:'Notes',type:'textarea',placeholder:'Fine motor observations...'}]},
  {id:'gross_motor_ot',title:'Gross Motor Skills',type:'mixed',specialty:'ot',fields:[{id:'balance',label:'Balance',type:'dropdown',options:['Within normal limits','Mild difficulty','Moderate difficulty','Significant difficulty']},{id:'coordination',label:'Coordination',type:'dropdown',options:['Within normal limits','Mild difficulty','Moderate difficulty','Significant difficulty']},{id:'notes',label:'Notes',type:'textarea',placeholder:'Gross motor observations...'}]},
  {id:'visual_motor',title:'Visual Motor Integration',type:'structured',specialty:'ot',fields:[{id:'test',label:'Test Used',type:'text',placeholder:'e.g. Beery VMI'},{id:'score',label:'Standard Score',type:'text',placeholder:''},{id:'percentile',label:'Percentile',type:'text',placeholder:''},{id:'interpretation',label:'Interpretation',type:'dropdown',options:['Above Average','Average','Below Average','Significantly Below Average']},{id:'notes',label:'Notes',type:'textarea',placeholder:''}]},
  {id:'visual_perception',title:'Visual Perception',type:'structured',specialty:'ot',fields:[{id:'test',label:'Test Used',type:'text',placeholder:'e.g. TVPS-4'},{id:'score',label:'Score',type:'text',placeholder:''},{id:'notes',label:'Notes',type:'textarea',placeholder:''}]},
  {id:'sensory_processing',title:'Sensory Processing',type:'structured',specialty:'ot',fields:[{id:'auditory',label:'Auditory',type:'dropdown',options:['Typical','Some problems','Definite dysfunction']},{id:'visual',label:'Visual',type:'dropdown',options:['Typical','Some problems','Definite dysfunction']},{id:'tactile',label:'Tactile',type:'dropdown',options:['Typical','Some problems','Definite dysfunction']},{id:'vestibular',label:'Vestibular',type:'dropdown',options:['Typical','Some problems','Definite dysfunction']},{id:'proprioceptive',label:'Proprioceptive',type:'dropdown',options:['Typical','Some problems','Definite dysfunction']},{id:'notes',label:'Notes',type:'textarea',placeholder:''}]},
  {id:'self_care',title:'Self-Care / ADLs',type:'structured',specialty:'ot',fields:[{id:'dressing',label:'Dressing',type:'dropdown',options:['Independent','Minimal assist','Moderate assist','Maximum assist','Dependent']},{id:'feeding',label:'Feeding',type:'dropdown',options:['Independent','Minimal assist','Moderate assist','Maximum assist','Dependent']},{id:'hygiene',label:'Hygiene',type:'dropdown',options:['Independent','Minimal assist','Moderate assist','Maximum assist','Dependent']},{id:'toileting',label:'Toileting',type:'dropdown',options:['Independent','Minimal assist','Moderate assist','Maximum assist','Dependent']},{id:'notes',label:'Notes',type:'textarea',placeholder:''}]},
  {id:'handwriting',title:'Handwriting / Pre-writing',type:'mixed',specialty:'ot',fields:[{id:'legibility',label:'Legibility',type:'dropdown',options:['Good','Fair','Poor']},{id:'sizing',label:'Sizing',type:'dropdown',options:['Appropriate','Inconsistent','Too large','Too small']},{id:'spacing',label:'Spacing',type:'dropdown',options:['Appropriate','Inconsistent','Crowded']},{id:'notes',label:'Notes',type:'textarea',placeholder:''}]},
  {id:'play_skills',title:'Play Skills',type:'freetext',specialty:'ot',fields:[{id:'text',label:'Play Skills',type:'textarea',placeholder:'Play observations, developmental level of play...'}]},
  {id:'classroom_function',title:'Classroom / School Function',type:'freetext',specialty:'ot',fields:[{id:'text',label:'Classroom Function',type:'textarea',placeholder:'Attention, task completion, following directions...'}]},
  {id:'bilateral_coord',title:'Bilateral Coordination',type:'freetext',specialty:'ot',fields:[{id:'text',label:'Bilateral Coordination',type:'textarea',placeholder:'Crossing midline, bilateral tasks...'}]},

  // ── Physical Therapy ──
  {id:'rom',title:'Range of Motion',type:'structured',specialty:'pt',fields:[{id:'entries',label:'ROM Measurements',type:'repeatable',subfields:[{id:'body_part',label:'Body Part',type:'text',placeholder:'e.g. Right Knee'},{id:'degrees',label:'Degrees',type:'text',placeholder:'e.g. 120°'},{id:'comparison',label:'Comparison to Norms',type:'text',placeholder:'e.g. WNL / Reduced'}]}]},
  {id:'strength_tone',title:'Strength / Muscle Tone',type:'structured',specialty:'pt',fields:[{id:'entries',label:'Muscle Groups',type:'repeatable',subfields:[{id:'group',label:'Muscle Group',type:'text',placeholder:'e.g. Quadriceps'},{id:'rating',label:'Rating (0-5)',type:'dropdown',options:['0','1','2','3','4','5']},{id:'notes',label:'Notes',type:'text',placeholder:''}]}]},
  {id:'balance_pt',title:'Balance',type:'mixed',specialty:'pt',fields:[{id:'static',label:'Static Balance',type:'dropdown',options:['Within normal limits','Mild impairment','Moderate impairment','Severe impairment']},{id:'dynamic',label:'Dynamic Balance',type:'dropdown',options:['Within normal limits','Mild impairment','Moderate impairment','Severe impairment']},{id:'notes',label:'Notes',type:'textarea',placeholder:''}]},
  {id:'coordination_pt',title:'Coordination',type:'freetext',specialty:'pt',fields:[{id:'text',label:'Coordination',type:'textarea',placeholder:''}]},
  {id:'gait',title:'Gait Analysis',type:'mixed',specialty:'pt',fields:[{id:'pattern',label:'Gait Pattern',type:'dropdown',options:['Normal','Antalgic','Trendelenburg','Scissoring','Waddling','Other']},{id:'deviations',label:'Deviations',type:'checklist',options:['Toe walking','Flat foot','Knee hyperextension','Hip drop','Trunk lean','Asymmetry']},{id:'assistive',label:'Assistive Devices',type:'text',placeholder:'e.g. Walker, AFOs'},{id:'notes',label:'Notes',type:'textarea',placeholder:''}]},
  {id:'gross_motor_milestones',title:'Gross Motor Milestones',type:'structured',specialty:'pt',fields:[{id:'milestones',label:'Milestones',type:'checklist',options:['Rolling','Sitting independently','Crawling','Pulling to stand','Cruising','Walking independently','Running','Jumping','Hopping','Stair climbing']}]},
  {id:'posture',title:'Posture / Alignment',type:'freetext',specialty:'pt',fields:[{id:'text',label:'Posture',type:'textarea',placeholder:'Posture and alignment observations...'}]},
  {id:'pain',title:'Pain Assessment',type:'mixed',specialty:'pt',fields:[{id:'location',label:'Location',type:'text',placeholder:'e.g. Lower back, right knee'},{id:'intensity',label:'Intensity (0-10)',type:'scale',min:0,max:10,step:1,defaultValue:0},{id:'triggers',label:'Triggers',type:'text',placeholder:'e.g. Walking, sitting'},{id:'notes',label:'Notes',type:'textarea',placeholder:''}]},
  {id:'functional_mobility',title:'Functional Mobility',type:'freetext',specialty:'pt',fields:[{id:'text',label:'Functional Mobility',type:'textarea',placeholder:'Transfers, bed mobility, functional reach...'}]},

  // ── Behavioral / Psychology ──
  {id:'behavioral_obs_psych',title:'Behavioral Observations',type:'freetext',specialty:'behavioral',fields:[{id:'text',label:'Observations',type:'textarea',placeholder:'Attention, compliance, affect, behavioral patterns...'}]},
  {id:'attention_ef',title:'Attention / Executive Function',type:'mixed',specialty:'behavioral',fields:[{id:'sustained',label:'Sustained Attention',type:'dropdown',options:['Within normal limits','Mild difficulty','Moderate difficulty','Significant difficulty']},{id:'divided',label:'Divided Attention',type:'dropdown',options:['Within normal limits','Mild difficulty','Moderate difficulty','Significant difficulty']},{id:'shifting',label:'Shifting',type:'dropdown',options:['Within normal limits','Mild difficulty','Moderate difficulty','Significant difficulty']},{id:'notes',label:'Notes',type:'textarea',placeholder:''}]},
  {id:'social_skills',title:'Social Interaction / Social Skills',type:'freetext',specialty:'behavioral',fields:[{id:'text',label:'Social Skills',type:'textarea',placeholder:'Peer interactions, social awareness...'}]},
  {id:'emotional_regulation',title:'Emotional Regulation',type:'mixed',specialty:'behavioral',fields:[{id:'checklist',label:'Observed Difficulties',type:'checklist',options:['Tantrums/meltdowns','Difficulty with transitions','Anxiety','Mood swings','Aggression','Withdrawal','Self-injury']},{id:'notes',label:'Notes',type:'textarea',placeholder:''}]},
  {id:'cognitive_assessment',title:'Cognitive Assessment',type:'structured',specialty:'behavioral',fields:[{id:'tests',label:'Test Results',type:'repeatable',subfields:[{id:'test_name',label:'Test Name',type:'text',placeholder:''},{id:'score',label:'Score',type:'text',placeholder:''},{id:'percentile',label:'Percentile',type:'text',placeholder:''},{id:'interpretation',label:'Interpretation',type:'text',placeholder:''}]}]},
  {id:'adaptive_behavior',title:'Adaptive Behavior',type:'freetext',specialty:'behavioral',fields:[{id:'text',label:'Adaptive Behavior',type:'textarea',placeholder:''}]},
  {id:'sleep_routine',title:'Sleep / Routine Patterns',type:'freetext',specialty:'behavioral',fields:[{id:'text',label:'Sleep/Routine',type:'textarea',placeholder:''}]},
  {id:'family_dynamics',title:'Family Dynamics',type:'freetext',specialty:'behavioral',fields:[{id:'text',label:'Family Dynamics',type:'textarea',placeholder:''}]},
];

// Map profession strings to specialty keys
const PROF_MAP = {
  'speech':'speech','speech-language':'speech','speech therapist':'speech','speech-language therapist':'speech','slp':'speech',
  'occupational':'ot','occupational therapy':'ot','occupational therapist':'ot','ot':'ot',
  'physical':'pt','physical therapy':'pt','physical therapist':'pt','physiotherapist':'pt','pt':'pt',
  'behavioral':'behavioral','psychology':'behavioral','psychologist':'behavioral','bcba':'behavioral','aba':'behavioral',
};

export function getSpecialtyKey(profession) {
  if (!profession) return null;
  const p = profession.toLowerCase().trim();
  for (const [key, val] of Object.entries(PROF_MAP)) {
    if (p.includes(key)) return val;
  }
  return null;
}

export function getSectionsForSpecialty(profession) {
  const specKey = getSpecialtyKey(profession);
  const universal = SECTION_LIBRARY.filter(s => s.specialty === 'universal');
  const specific = specKey ? SECTION_LIBRARY.filter(s => s.specialty === specKey) : [];
  return { universal, specific, specKey };
}

export function getOtherSpecialtySections(excludeKey) {
  const specialties = ['speech', 'ot', 'pt', 'behavioral'];
  const result = {};
  specialties.filter(k => k !== excludeKey).forEach(k => {
    result[k] = SECTION_LIBRARY.filter(s => s.specialty === k);
  });
  return result;
}

export function getSectionById(id) {
  return SECTION_LIBRARY.find(s => s.id === id) || null;
}

// ─── Template CRUD ───
export async function loadTemplates() {
  const { _supa, session } = window.HUD || {};
  if (!_supa || !session) return [];
  try {
    const { data, error } = await _supa.from('report_templates').select('*').eq('specialist_id', session.id).order('updated_at', { ascending: false });
    if (error) { console.error('[templates] Load error:', error.message, error.details); return []; }
    console.log('[templates] Loaded', (data || []).length, 'templates for', session.id);
    return data || [];
  } catch (e) { console.error('Load templates:', e); return []; }
}

export async function saveTemplate(template) {
  const { _supa, session } = window.HUD || {};
  if (!_supa || !session) throw new Error('Not authenticated');
  const payload = {
    specialist_id: session.id,
    name: template.name,
    description: template.description || null,
    sections: template.sections,
    writing_style: template.writing_style || null,
    source: template.source || 'manual',
    updated_at: new Date().toISOString(),
  };
  if (template.content) { payload.content = template.content; payload.schema_version = template.schema_version || 1; }
  if (template.id) {
    const { error } = await _supa.from('report_templates').update(payload).eq('id', template.id);
    if (error) throw error;
    return template.id;
  } else {
    const { data, error } = await _supa.from('report_templates').insert(payload).select('id').single();
    if (error) throw error;
    return data.id;
  }
}

export async function deleteTemplate(id) {
  const { _supa } = window.HUD || {};
  if (!_supa) return;
  await _supa.from('report_templates').delete().eq('id', id);
}
