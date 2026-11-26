/**
 * qTest Assistant → Project ID Mapping
 *
 * Maps assistant URL slugs (the `name` field) to their corresponding qTest project IDs.
 * When a user opens "qTest Search" from a SmartNote, the assistant name is looked up
 * here to automatically resolve the project ID — no manual entry required.
 *
 * To add a new assistant: add one line below.
 * To remove an assistant: delete its line.
 * IDs are numeric qTest project identifiers.
 */
export const QTEST_PROJECT_MAP = {
  'care-without-delay':                     637,
  'cerner-lab':                             835,
  'clinical-library':                       632,
  'econsult':                               949,
  'get-care-now':                           501,
  'happy-together':                         510,
  'health-information-exchangekpo':         511,
  'home-medical-equipment':                1133,
  'impravata':                              397,
  'inpatient-careagility':                  887,
  'insights-driven':                        390,
  'kp-mobile':                               15,
  'kphc-dsnp-phase-2':                     1050,
  'kpsom':                                  834,
  'kpsom-analytics':                       1048,
  'kpsom-sis':                             1046,
  'kpnevada':                              1270,
  'mnce':                                  1175,
  'mychart-evolution':                      382,
  'ncal-spm-and-epic-surgical-integration':1134,
  'nexgenpacs':                             685,
  'online-pt':                              951,
  'pharmacy':                               956,
  'remote-patient-monitoring':              952,
  'rev-cycle':                              499,
  'mobility-video-visits':                  484,
  'ecommerce':                             1265,
  'fhir':                                  1006,
  'ctp-onelink':                            345,
  'risk-adjustment-steady-state':          1122,
  'hrpdt':                                  208,
  'scheduletopay':                         1045,
  'hr133-continuity-of-care':              1008,
  'receive-care':                            85,
  'crtmce':                                1001,
  'kpmc-assistant':                         545,
  'cms-assistant':                          555,
};
