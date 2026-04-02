// Report Template Definitions

export const TEMPLATES = [
  {
    id: 'session_soap',
    name: 'Session Summary (SOAP)',
    icon: '📝',
    description: 'Single session documentation',
    sections: [
      {
        id: 'admin', title: 'Administrative', autoFilled: true, fields: []
      },
      {
        id: 'subjective', title: 'Subjective',
        description: 'What the patient/parent reports',
        fields: [
          { id: 'parent_report', label: 'Parent/Patient Report', type: 'textarea', placeholder: 'What did the parent or child report today?' },
          { id: 'mood_engagement', label: 'Mood & Engagement', type: 'dropdown', options: ['Cooperative and engaged', 'Mostly cooperative', 'Variable engagement', 'Resistant/Uncooperative', 'Other'] },
          { id: 'subjective_notes', label: 'Additional Notes', type: 'textarea', placeholder: 'Any other subjective observations...' }
        ]
      },
      {
        id: 'objective', title: 'Objective',
        description: 'Measurable data and observations',
        fields: [
          { id: 'activities', label: 'Activities/Tasks', type: 'textarea', placeholder: 'What activities were conducted during the session?' },
          { id: 'performance', label: 'Performance Data', type: 'textarea', placeholder: 'Accuracy percentages, scores, measurable outcomes...' },
          { id: 'techniques', label: 'Techniques Used', type: 'textarea', placeholder: 'Therapeutic techniques and approaches used...' }
        ]
      },
      {
        id: 'assessment', title: 'Assessment',
        description: 'Professional interpretation',
        fields: [
          { id: 'progress', label: 'Progress Toward Goals', type: 'dropdown', options: ['Significant progress', 'Moderate progress', 'Minimal progress', 'No change', 'Regression'] },
          { id: 'assessment_notes', label: 'Clinical Assessment', type: 'textarea', placeholder: 'Your professional interpretation of today\'s session...' }
        ]
      },
      {
        id: 'plan', title: 'Plan',
        description: 'Next steps',
        fields: [
          { id: 'next_session', label: 'Next Session Focus', type: 'textarea', placeholder: 'What will be addressed in the next session?' },
          { id: 'homework', label: 'Home Program/Homework', type: 'textarea', placeholder: 'Activities assigned for home practice...' },
          { id: 'next_date', label: 'Next Session Date', type: 'text', placeholder: 'Date or timeframe...' }
        ]
      }
    ]
  },
  {
    id: 'assessment_speech',
    name: 'Speech-Language Assessment',
    icon: '📋',
    description: 'Initial speech-language evaluation',
    sections: [
      { id: 'admin', title: 'Administrative', autoFilled: true, fields: [
        { id: 'referral_source', label: 'Referral Source', type: 'text', placeholder: 'e.g. Pediatrician, self-referred, school' }
      ]},
      { id: 'background', title: 'Background', fields: [
        { id: 'reason_referral', label: 'Reason for Referral', type: 'textarea', placeholder: 'Why was the child referred?' },
        { id: 'medical_history', label: 'Medical/Developmental History', type: 'textarea', placeholder: 'Relevant medical and developmental history' },
        { id: 'previous_therapy', label: 'Previous Therapy', type: 'textarea', placeholder: 'Previous speech, OT, PT or other therapy' },
        { id: 'parent_concerns', label: 'Parent Concerns', type: 'textarea', placeholder: 'What are the parent\'s main concerns?' }
      ]},
      { id: 'oral_motor', title: 'Oral Motor Examination', fields: [
        { id: 'oral_structure', label: 'Structure', type: 'dropdown', options: ['Within normal limits', 'Abnormalities noted'] },
        { id: 'oral_function', label: 'Function', type: 'dropdown', options: ['Within normal limits', 'Abnormalities noted'] },
        { id: 'oral_notes', label: 'Notes', type: 'textarea', placeholder: 'Details of oral motor findings...' }
      ]},
      { id: 'articulation', title: 'Articulation / Phonology', fields: [
        { id: 'sounds_in_error', label: 'Sounds in Error', type: 'text', placeholder: 'e.g. /r/, /s/, /l/ blends' },
        { id: 'intelligibility', label: 'Intelligibility (%)', type: 'scale', min: 0, max: 100, step: 5, defaultValue: 80 },
        { id: 'artic_context', label: 'Context', type: 'checklist', options: ['Word level', 'Sentence level', 'Conversation'] },
        { id: 'artic_notes', label: 'Notes', type: 'textarea', placeholder: 'Additional articulation observations...' }
      ]},
      { id: 'receptive', title: 'Receptive Language', fields: [
        { id: 'rec_test', label: 'Test Used', type: 'dropdown', options: ['CELF-5', 'PLS-5', 'ROWPVT-4', 'PPVT-5', 'CELF Preschool-3', 'Other'] },
        { id: 'rec_standard', label: 'Standard Score', type: 'text', placeholder: 'e.g. 95' },
        { id: 'rec_percentile', label: 'Percentile', type: 'text', placeholder: 'e.g. 37' },
        { id: 'rec_interpretation', label: 'Interpretation', type: 'dropdown', options: ['Above Average', 'Average', 'Below Average', 'Significantly Below Average'] },
        { id: 'rec_notes', label: 'Notes', type: 'textarea', placeholder: 'Additional observations...' }
      ]},
      { id: 'expressive', title: 'Expressive Language', fields: [
        { id: 'exp_test', label: 'Test Used', type: 'dropdown', options: ['CELF-5', 'PLS-5', 'EOWPVT-4', 'EVT-3', 'CELF Preschool-3', 'Other'] },
        { id: 'exp_standard', label: 'Standard Score', type: 'text', placeholder: 'e.g. 82' },
        { id: 'exp_percentile', label: 'Percentile', type: 'text', placeholder: 'e.g. 12' },
        { id: 'exp_interpretation', label: 'Interpretation', type: 'dropdown', options: ['Above Average', 'Average', 'Below Average', 'Significantly Below Average'] },
        { id: 'exp_notes', label: 'Notes', type: 'textarea', placeholder: 'Additional observations...' }
      ]},
      { id: 'fluency_voice', title: 'Fluency & Voice', fields: [
        { id: 'fluency', label: 'Fluency', type: 'dropdown', options: ['Within normal limits', 'Mild disfluency', 'Moderate disfluency', 'Severe disfluency'] },
        { id: 'voice', label: 'Voice', type: 'dropdown', options: ['Within normal limits', 'Hoarse', 'Breathy', 'Nasal', 'Other'] },
        { id: 'fv_notes', label: 'Notes', type: 'textarea', placeholder: 'Additional fluency/voice observations...' }
      ]},
      { id: 'pragmatics', title: 'Pragmatics / Social Communication', fields: [
        { id: 'pragmatics_notes', label: 'Observations', type: 'textarea', placeholder: 'Eye contact, turn-taking, topic maintenance, social awareness...' }
      ]},
      { id: 'summary', title: 'Clinical Summary', fields: [
        { id: 'impression', label: 'Clinical Impression', type: 'textarea', placeholder: 'Your professional assessment summary' },
        { id: 'severity', label: 'Severity', type: 'dropdown', options: ['Within Normal Limits', 'Mild', 'Moderate', 'Severe', 'Profound'] },
        { id: 'strengths', label: 'Strengths', type: 'textarea', placeholder: 'Areas of strength observed' },
        { id: 'concerns', label: 'Areas of Concern', type: 'textarea', placeholder: 'Primary areas of concern' }
      ]},
      { id: 'recommendations', title: 'Recommendations', fields: [
        { id: 'therapy_recommended', label: 'Therapy Recommended', type: 'dropdown', options: ['Yes', 'No', 'Re-evaluation recommended'] },
        { id: 'frequency', label: 'Frequency', type: 'dropdown', options: ['1x/week', '2x/week', '3x/week', 'Monthly', 'As needed'] },
        { id: 'duration', label: 'Session Duration', type: 'dropdown', options: ['30 minutes', '45 minutes', '60 minutes'] },
        { id: 'goals', label: 'Goals', type: 'goals', placeholder: 'Add therapy goals...' },
        { id: 'home_recommendations', label: 'Home Recommendations', type: 'textarea', placeholder: 'Activities and strategies for parents...' }
      ]}
    ]
  }
];

export function getTemplate(id) {
  return TEMPLATES.find(t => t.id === id) || null;
}
