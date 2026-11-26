// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('org.kp.kpmc.core');
goog.require('cljs.core');
goog.require('org.kp.kpmc.io_node');
goog.require('org.kp.kpmc.parser');
goog.require('org.kp.kpmc.companion');
goog.require('org.kp.kpmc.enrich');
goog.require('org.kp.kpmc.companion_rules');
goog.require('org.kp.kpmc.structural_validation');
goog.require('org.kp.kpmc.mapping_export');
goog.require('org.kp.kpmc.cli');
org.kp.kpmc.core.read_text = org.kp.kpmc.io_node.read_text;
org.kp.kpmc.core.write_text = org.kp.kpmc.io_node.write_text;
org.kp.kpmc.core.to_edn_text = org.kp.kpmc.io_node.to_edn_text;
org.kp.kpmc.core.reverso = org.kp.kpmc.parser.reverso;
org.kp.kpmc.core.extract_text_by_span = org.kp.kpmc.parser.extract_text_by_span;
org.kp.kpmc.core.find_in_parse_tree = org.kp.kpmc.parser.find_in_parse_tree;
org.kp.kpmc.core.find_all_nodes = org.kp.kpmc.parser.find_all_nodes;
org.kp.kpmc.core.create_parsers = org.kp.kpmc.parser.create_parsers;
org.kp.kpmc.core.testX12 = org.kp.kpmc.parser.testX12;
org.kp.kpmc.core.testX12_stage1 = org.kp.kpmc.parser.testX12_stage1;
org.kp.kpmc.core.testX12_stage2 = org.kp.kpmc.parser.testX12_stage2;
org.kp.kpmc.core.testX12_stage3 = org.kp.kpmc.parser.testX12_stage3;
org.kp.kpmc.core.testX12_hierarchical = org.kp.kpmc.parser.testX12_hierarchical;
org.kp.kpmc.core.parse_envelope = org.kp.kpmc.parser.parse_envelope;
org.kp.kpmc.core.extract_function_bodies = org.kp.kpmc.parser.extract_function_bodies;
org.kp.kpmc.core.parse_function_body = org.kp.kpmc.parser.parse_function_body;
org.kp.kpmc.core.extract_transaction_sets = org.kp.kpmc.parser.extract_transaction_sets;
org.kp.kpmc.core.parse_trans_body = org.kp.kpmc.parser.parse_trans_body;
org.kp.kpmc.core.parse_x12_chunked = org.kp.kpmc.parser.parse_x12_chunked;
org.kp.kpmc.core.test_chunked_parse = org.kp.kpmc.parser.test_chunked_parse;
org.kp.kpmc.core.parse_x12_full = org.kp.kpmc.parser.parse_x12_full;
org.kp.kpmc.core.test_full_parse = org.kp.kpmc.parser.test_full_parse;
org.kp.kpmc.core.parse_x12_chunked_json = (function org$kp$kpmc$core$parse_x12_chunked_json(filepath){
return cljs.core.clj__GT_js.call(null,org.kp.kpmc.parser.parse_x12_chunked.call(null,filepath));
});
org.kp.kpmc.core.parse_x12_full_json = (function org$kp$kpmc$core$parse_x12_full_json(filepath){
return cljs.core.clj__GT_js.call(null,org.kp.kpmc.parser.parse_x12_full.call(null,filepath));
});
org.kp.kpmc.core.join_multiline_quoted_fields = org.kp.kpmc.companion.join_multiline_quoted_fields;
org.kp.kpmc.core.join_multiline_quoted_fields_with_source = org.kp.kpmc.companion.join_multiline_quoted_fields_with_source;
org.kp.kpmc.core.parse_csv_line = org.kp.kpmc.companion.parse_csv_line;
org.kp.kpmc.core.parse_loop_header = org.kp.kpmc.companion.parse_loop_header;
org.kp.kpmc.core.parse_companion_guide_text = org.kp.kpmc.companion.parse_companion_guide_text;
org.kp.kpmc.core.parse_companion_guide = org.kp.kpmc.companion.parse_companion_guide;
org.kp.kpmc.core.save_companion_guide_edn = org.kp.kpmc.companion.save_companion_guide_edn;
org.kp.kpmc.core.parse_segment_ref = org.kp.kpmc.companion.parse_segment_ref;
org.kp.kpmc.core.mapping__GT_lookup_specs = org.kp.kpmc.mapping_export.mapping__GT_lookup_specs;
org.kp.kpmc.core.write_lookup_specs_BANG_ = org.kp.kpmc.mapping_export.write_lookup_specs_BANG_;
org.kp.kpmc.core.export_mapping_BANG_ = org.kp.kpmc.mapping_export.export_mapping_BANG_;
org.kp.kpmc.core.parse_companion_guide_json = (function org$kp$kpmc$core$parse_companion_guide_json(csv_file){
return cljs.core.clj__GT_js.call(null,org.kp.kpmc.companion.parse_companion_guide.call(null,csv_file));
});
org.kp.kpmc.core.parse_companion_guide_editable_text_json = (function org$kp$kpmc$core$parse_companion_guide_editable_text_json(csv_text,opts_json){
var opts = (((!((opts_json == null))))?cljs.core.js__GT_clj.call(null,opts_json,new cljs.core.Keyword(null,"keywordize-keys","keywordize-keys",1310784252),true):cljs.core.PersistentArrayMap.EMPTY);
var model = org.kp.kpmc.companion_rules.parse_companion_csv__GT_model.call(null,csv_text);
return cljs.core.clj__GT_js.call(null,org.kp.kpmc.companion_rules.model__GT_editable_document.call(null,model,new cljs.core.Keyword(null,"sourceName","sourceName",894858305).cljs$core$IFn$_invoke$arity$1(opts)));
});
org.kp.kpmc.core.parse_companion_guide_editable_json = (function org$kp$kpmc$core$parse_companion_guide_editable_json(csv_file){
var path = require("path");
var model = org.kp.kpmc.companion_rules.parse_companion_csv__GT_model.call(null,org.kp.kpmc.io_node.read_text.call(null,csv_file));
return cljs.core.clj__GT_js.call(null,org.kp.kpmc.companion_rules.model__GT_editable_document.call(null,model,path.basename(csv_file)));
});
org.kp.kpmc.core.build_companion_index = org.kp.kpmc.enrich.build_companion_index;
org.kp.kpmc.core.find_loop_def = org.kp.kpmc.enrich.find_loop_def;
org.kp.kpmc.core.annotate_children = org.kp.kpmc.enrich.annotate_children;
org.kp.kpmc.core.parse_kp_allowed_values = org.kp.kpmc.enrich.parse_kp_allowed_values;
org.kp.kpmc.core.validate_kp_format = org.kp.kpmc.enrich.validate_kp_format;
org.kp.kpmc.core.validate_element = org.kp.kpmc.enrich.validate_element;
org.kp.kpmc.core.annotate_and_validate_children = org.kp.kpmc.enrich.annotate_and_validate_children;
org.kp.kpmc.core.enrich_parse_tree = org.kp.kpmc.enrich.enrich_parse_tree;
org.kp.kpmc.core.enrich_x12_with_companion_guide = org.kp.kpmc.enrich.enrich_x12_with_companion_guide;
org.kp.kpmc.core.enrich_parse_tree_json = (function org$kp$kpmc$core$enrich_parse_tree_json(parse_tree_json,companion_guide_json){
var keywordize_node_tags = (function org$kp$kpmc$core$enrich_parse_tree_json_$_keywordize_node_tags(node){
if(cljs.core.vector_QMARK_.call(null,node)){
var head = cljs.core.first.call(null,node);
var normalized_head = ((typeof head === 'string')?cljs.core.keyword.call(null,head):head);
return cljs.core.into.call(null,new cljs.core.PersistentVector(null, 1, 5, cljs.core.PersistentVector.EMPTY_NODE, [normalized_head], null),cljs.core.map.call(null,org$kp$kpmc$core$enrich_parse_tree_json_$_keywordize_node_tags,cljs.core.rest.call(null,node)));
} else {
if(cljs.core.map_QMARK_.call(null,node)){
return cljs.core.into.call(null,cljs.core.PersistentArrayMap.EMPTY,cljs.core.map.call(null,(function (p__1922){
var vec__1923 = p__1922;
var k = cljs.core.nth.call(null,vec__1923,(0),null);
var v = cljs.core.nth.call(null,vec__1923,(1),null);
return new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [k,org$kp$kpmc$core$enrich_parse_tree_json_$_keywordize_node_tags.call(null,v)], null);
}),node));
} else {
if(cljs.core.sequential_QMARK_.call(null,node)){
return cljs.core.mapv.call(null,org$kp$kpmc$core$enrich_parse_tree_json_$_keywordize_node_tags,node);
} else {
return node;

}
}
}
});
var parse_tree = keywordize_node_tags.call(null,cljs.core.js__GT_clj.call(null,parse_tree_json,new cljs.core.Keyword(null,"keywordize-keys","keywordize-keys",1310784252),true));
var companion_guide = cljs.core.js__GT_clj.call(null,companion_guide_json,new cljs.core.Keyword(null,"keywordize-keys","keywordize-keys",1310784252),true);
return cljs.core.clj__GT_js.call(null,org.kp.kpmc.enrich.enrich_parse_tree.call(null,parse_tree,companion_guide));
});
org.kp.kpmc.core.run_rule_harness = org.kp.kpmc.companion_rules.run_rule_harness;
org.kp.kpmc.core.run_structural_rule_harness = org.kp.kpmc.structural_validation.run_structural_rule_harness;
org.kp.kpmc.core.compare_rule_harnesses = org.kp.kpmc.structural_validation.compare_rule_harnesses;
org.kp.kpmc.core.normalize_rule_harness_opts = (function org$kp$kpmc$core$normalize_rule_harness_opts(opts){
var o = (function (){var or__5142__auto__ = opts;
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return cljs.core.PersistentArrayMap.EMPTY;
}
})();
var G__1926 = o;
var G__1926__$1 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"lookupSpecFile","lookupSpecFile",-1361988788)))?cljs.core.assoc.call(null,G__1926,new cljs.core.Keyword(null,"lookup-spec-file","lookup-spec-file",687065480),new cljs.core.Keyword(null,"lookupSpecFile","lookupSpecFile",-1361988788).cljs$core$IFn$_invoke$arity$1(o)):G__1926);
var G__1926__$2 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"includeLookupSql","includeLookupSql",204121854)))?cljs.core.assoc.call(null,G__1926__$1,new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460),new cljs.core.Keyword(null,"includeLookupSql","includeLookupSql",204121854).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$1);
var G__1926__$3 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"includeLookupSql?","includeLookupSql?",1509965706)))?cljs.core.assoc.call(null,G__1926__$2,new cljs.core.Keyword(null,"include-lookup-sql?","include-lookup-sql?",212730460),new cljs.core.Keyword(null,"includeLookupSql?","includeLookupSql?",1509965706).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$2);
var G__1926__$4 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"dbValidation","dbValidation",-1173401578)))?cljs.core.assoc.call(null,G__1926__$3,new cljs.core.Keyword(null,"db-validation?","db-validation?",2032147196),new cljs.core.Keyword(null,"dbValidation","dbValidation",-1173401578).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$3);
var G__1926__$5 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"dbValidation?","dbValidation?",-1221893341)))?cljs.core.assoc.call(null,G__1926__$4,new cljs.core.Keyword(null,"db-validation?","db-validation?",2032147196),new cljs.core.Keyword(null,"dbValidation?","dbValidation?",-1221893341).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$4);
var G__1926__$6 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"progressOutputFile","progressOutputFile",699471945)))?cljs.core.assoc.call(null,G__1926__$5,new cljs.core.Keyword(null,"progress-output-file","progress-output-file",-119062875),new cljs.core.Keyword(null,"progressOutputFile","progressOutputFile",699471945).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$5);
var G__1926__$7 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"onProgress","onProgress",987195821)))?cljs.core.assoc.call(null,G__1926__$6,new cljs.core.Keyword(null,"on-progress","on-progress",1196110410),new cljs.core.Keyword(null,"onProgress","onProgress",987195821).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$6);
var G__1926__$8 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"heartbeatEveryDbAttempts","heartbeatEveryDbAttempts",-1620453129)))?cljs.core.assoc.call(null,G__1926__$7,new cljs.core.Keyword(null,"heartbeat-every-db-attempts","heartbeat-every-db-attempts",45700953),new cljs.core.Keyword(null,"heartbeatEveryDbAttempts","heartbeatEveryDbAttempts",-1620453129).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$7);
var G__1926__$9 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"runId","runId",505587730)))?cljs.core.assoc.call(null,G__1926__$8,new cljs.core.Keyword(null,"run-id","run-id",-1745267908),new cljs.core.Keyword(null,"runId","runId",505587730).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$8);
var G__1926__$10 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"totalSubscribers","totalSubscribers",-1502855776)))?cljs.core.assoc.call(null,G__1926__$9,new cljs.core.Keyword(null,"total-subscribers","total-subscribers",642299170),new cljs.core.Keyword(null,"totalSubscribers","totalSubscribers",-1502855776).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$9);
var G__1926__$11 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"singleQueryDbValidation","singleQueryDbValidation",2034720698)))?cljs.core.assoc.call(null,G__1926__$10,new cljs.core.Keyword(null,"single-query-db-validation?","single-query-db-validation?",-963174521),new cljs.core.Keyword(null,"singleQueryDbValidation","singleQueryDbValidation",2034720698).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$10);
var G__1926__$12 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"singleQueryDbValidation?","singleQueryDbValidation?",240985461)))?cljs.core.assoc.call(null,G__1926__$11,new cljs.core.Keyword(null,"single-query-db-validation?","single-query-db-validation?",-963174521),new cljs.core.Keyword(null,"singleQueryDbValidation?","singleQueryDbValidation?",240985461).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$11);
var G__1926__$13 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"compareSingleQueryVsLegacy","compareSingleQueryVsLegacy",-302533470)))?cljs.core.assoc.call(null,G__1926__$12,new cljs.core.Keyword(null,"compare-single-query-vs-legacy?","compare-single-query-vs-legacy?",-1756464179),new cljs.core.Keyword(null,"compareSingleQueryVsLegacy","compareSingleQueryVsLegacy",-302533470).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$12);
var G__1926__$14 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"compareSingleQueryVsLegacy?","compareSingleQueryVsLegacy?",-589659506)))?cljs.core.assoc.call(null,G__1926__$13,new cljs.core.Keyword(null,"compare-single-query-vs-legacy?","compare-single-query-vs-legacy?",-1756464179),new cljs.core.Keyword(null,"compareSingleQueryVsLegacy?","compareSingleQueryVsLegacy?",-589659506).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$13);
var G__1926__$15 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"envName","envName",-1555267237)))?cljs.core.assoc.call(null,G__1926__$14,new cljs.core.Keyword(null,"env-name","env-name",1998966009),new cljs.core.Keyword(null,"envName","envName",-1555267237).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$14);
var G__1926__$16 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"subscriberOnlyDbValidation","subscriberOnlyDbValidation",608166416)))?cljs.core.assoc.call(null,G__1926__$15,new cljs.core.Keyword(null,"subscriber-only-db-validation?","subscriber-only-db-validation?",511213543),new cljs.core.Keyword(null,"subscriberOnlyDbValidation","subscriberOnlyDbValidation",608166416).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$15);
var G__1926__$17 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"logMemory","logMemory",36632689)))?cljs.core.assoc.call(null,G__1926__$16,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409),new cljs.core.Keyword(null,"logMemory","logMemory",36632689).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$16);
var G__1926__$18 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"includeParsed","includeParsed",-1404992084)))?cljs.core.assoc.call(null,G__1926__$17,new cljs.core.Keyword(null,"include-parsed?","include-parsed?",-260661768),new cljs.core.Keyword(null,"includeParsed","includeParsed",-1404992084).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$17);
var G__1926__$19 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"includeEnriched","includeEnriched",2016005566)))?cljs.core.assoc.call(null,G__1926__$18,new cljs.core.Keyword(null,"include-enriched?","include-enriched?",-1272866002),new cljs.core.Keyword(null,"includeEnriched","includeEnriched",2016005566).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$18);
var G__1926__$20 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"streaming","streaming",774370687)))?cljs.core.assoc.call(null,G__1926__$19,new cljs.core.Keyword(null,"streaming?","streaming?",-88445658),new cljs.core.Keyword(null,"streaming","streaming",774370687).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$19);
var G__1926__$21 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"readBufferSize","readBufferSize",-655204396)))?cljs.core.assoc.call(null,G__1926__$20,new cljs.core.Keyword(null,"read-buffer-size","read-buffer-size",-876215313),new cljs.core.Keyword(null,"readBufferSize","readBufferSize",-655204396).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$20);
var G__1926__$22 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"subscriberBatchSize","subscriberBatchSize",-1881084201)))?cljs.core.assoc.call(null,G__1926__$21,new cljs.core.Keyword(null,"subscriber-batch-size","subscriber-batch-size",417020345),new cljs.core.Keyword(null,"subscriberBatchSize","subscriberBatchSize",-1881084201).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$21);
var G__1926__$23 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"collectInvalidFindings","collectInvalidFindings",1629727179)))?cljs.core.assoc.call(null,G__1926__$22,new cljs.core.Keyword(null,"collect-invalid-findings?","collect-invalid-findings?",1737968512),new cljs.core.Keyword(null,"collectInvalidFindings","collectInvalidFindings",1629727179).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$22);
var G__1926__$24 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"collectSubscriberStatuses","collectSubscriberStatuses",1518077643)))?cljs.core.assoc.call(null,G__1926__$23,new cljs.core.Keyword(null,"collect-subscriber-statuses?","collect-subscriber-statuses?",773411372),new cljs.core.Keyword(null,"collectSubscriberStatuses","collectSubscriberStatuses",1518077643).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$23);
var G__1926__$25 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"findingBatchSize","findingBatchSize",-977714346)))?cljs.core.assoc.call(null,G__1926__$24,new cljs.core.Keyword(null,"finding-batch-size","finding-batch-size",569358789),new cljs.core.Keyword(null,"findingBatchSize","findingBatchSize",-977714346).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$24);
var G__1926__$26 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"onFindingBatch","onFindingBatch",990331618)))?cljs.core.assoc.call(null,G__1926__$25,new cljs.core.Keyword(null,"on-finding-batch","on-finding-batch",-1341968258),new cljs.core.Keyword(null,"onFindingBatch","onFindingBatch",990331618).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$25);
var G__1926__$27 = ((cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"findingOutputFile","findingOutputFile",-780700416)))?cljs.core.assoc.call(null,G__1926__$26,new cljs.core.Keyword(null,"finding-output-file","finding-output-file",-1281220345),new cljs.core.Keyword(null,"findingOutputFile","findingOutputFile",-780700416).cljs$core$IFn$_invoke$arity$1(o)):G__1926__$26);
if(cljs.core.contains_QMARK_.call(null,o,new cljs.core.Keyword(null,"validationScope","validationScope",-117496491))){
return cljs.core.assoc.call(null,G__1926__$27,new cljs.core.Keyword(null,"validation-scope","validation-scope",-1934647466),new cljs.core.Keyword(null,"validationScope","validationScope",-117496491).cljs$core$IFn$_invoke$arity$1(o));
} else {
return G__1926__$27;
}
});
org.kp.kpmc.core.capabilities_json = (function org$kp$kpmc$core$capabilities_json(){
return cljs.core.clj__GT_js.call(null,cljs.core.PersistentHashMap.fromArrays([new cljs.core.Keyword(null,"findingNdjsonOutput","findingNdjsonOutput",667617607),new cljs.core.Keyword(null,"compactInvalidFindings","compactInvalidFindings",-1643858233),new cljs.core.Keyword(null,"editableCompanionGuideSchemaVersion","editableCompanionGuideSchemaVersion",641176680),new cljs.core.Keyword(null,"editableCompanionGuide","editableCompanionGuide",1842738760),new cljs.core.Keyword(null,"subscriberBatching","subscriberBatching",-2057218260),new cljs.core.Keyword(null,"structural834Evaluation","structural834Evaluation",458168879),new cljs.core.Keyword(null,"structural834EvaluationVersion","structural834EvaluationVersion",-2014558887),new cljs.core.Keyword(null,"defaultSubscriberBatchSize","defaultSubscriberBatchSize",1963357977),new cljs.core.Keyword(null,"subscriberStatusCollectionControl","subscriberStatusCollectionControl",-1183657798),new cljs.core.Keyword(null,"treeOutputControls","treeOutputControls",751259291),new cljs.core.Keyword(null,"subscriberBoundedStreaming","subscriberBoundedStreaming",-1143514405),new cljs.core.Keyword(null,"findingBatchEvents","findingBatchEvents",1622550588),new cljs.core.Keyword(null,"isaProgressEvents","isaProgressEvents",-1515386658),new cljs.core.Keyword(null,"streaming","streaming",774370687)],[true,true,org.kp.kpmc.companion_rules.editable_companion_guide_schema_version,true,true,true,(1),(1),true,true,true,true,true,true]));
});
org.kp.kpmc.core.run_rule_harness_json = (function org$kp$kpmc$core$run_rule_harness_json(companion_csv,edi_file,opts_json){
var opts = org.kp.kpmc.core.normalize_rule_harness_opts.call(null,(((!((opts_json == null))))?cljs.core.js__GT_clj.call(null,opts_json,new cljs.core.Keyword(null,"keywordize-keys","keywordize-keys",1310784252),true):cljs.core.PersistentArrayMap.EMPTY));
return cljs.core.clj__GT_js.call(null,org.kp.kpmc.companion_rules.run_rule_harness.call(null,companion_csv,edi_file,opts));
});
org.kp.kpmc.core.run_structural_rule_harness_json = (function org$kp$kpmc$core$run_structural_rule_harness_json(companion_csv,edi_file,opts_json){
var opts = org.kp.kpmc.core.normalize_rule_harness_opts.call(null,(((!((opts_json == null))))?cljs.core.js__GT_clj.call(null,opts_json,new cljs.core.Keyword(null,"keywordize-keys","keywordize-keys",1310784252),true):cljs.core.PersistentArrayMap.EMPTY));
return cljs.core.clj__GT_js.call(null,org.kp.kpmc.structural_validation.run_structural_rule_harness.call(null,companion_csv,edi_file,opts));
});
org.kp.kpmc.core.compare_rule_harnesses_json = (function org$kp$kpmc$core$compare_rule_harnesses_json(companion_csv,edi_file,opts_json){
var opts = org.kp.kpmc.core.normalize_rule_harness_opts.call(null,(((!((opts_json == null))))?cljs.core.js__GT_clj.call(null,opts_json,new cljs.core.Keyword(null,"keywordize-keys","keywordize-keys",1310784252),true):cljs.core.PersistentArrayMap.EMPTY));
return cljs.core.clj__GT_js.call(null,org.kp.kpmc.structural_validation.compare_rule_harnesses.call(null,companion_csv,edi_file,opts));
});
org.kp.kpmc.core.rule_harness_result_json = (function org$kp$kpmc$core$rule_harness_result_json(harness,opts){
var _ = ((((new cljs.core.Keyword(null,"streaming?","streaming?",-88445658).cljs$core$IFn$_invoke$arity$1(opts) === true) && ((!(cljs.core.contains_QMARK_.call(null,harness,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078)))))))?(function(){throw cljs.core.ex_info.call(null,"Compiled EFS-S does not support bounded-memory streaming",new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"type","type",1174270348),new cljs.core.Keyword(null,"missing-streaming-capability","missing-streaming-capability",1258638208)], null))})():null);
var report = new cljs.core.Keyword(null,"report","report",1394055010).cljs$core$IFn$_invoke$arity$1(harness);
var include_parsed_QMARK_ = (!(new cljs.core.Keyword(null,"include-parsed?","include-parsed?",-260661768).cljs$core$IFn$_invoke$arity$1(opts) === false));
var include_enriched_QMARK_ = (!(new cljs.core.Keyword(null,"include-enriched?","include-enriched?",-1272866002).cljs$core$IFn$_invoke$arity$1(opts) === false));
var payload = (function (){var G__1927 = new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"validation-summary","validation-summary",-1267445308),new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"total","total",1916810418),cljs.core.get_in.call(null,report,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"validation","validation",-2141396518),new cljs.core.Keyword(null,"total","total",1916810418)], null)),new cljs.core.Keyword(null,"passed","passed",-28165278),cljs.core.get_in.call(null,report,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"validation","validation",-2141396518),new cljs.core.Keyword(null,"passed","passed",-28165278)], null)),new cljs.core.Keyword(null,"failed","failed",-1397425762),cljs.core.get_in.call(null,report,new cljs.core.PersistentVector(null, 2, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"validation","validation",-2141396518),new cljs.core.Keyword(null,"failed","failed",-1397425762)], null)),new cljs.core.Keyword(null,"lookup","lookup",1225356838),new cljs.core.Keyword(null,"lookup-summary","lookup-summary",1485614183).cljs$core$IFn$_invoke$arity$1(report),new cljs.core.Keyword(null,"subscriber-progress","subscriber-progress",-1474255366),new cljs.core.Keyword(null,"subscriber-progress-summary","subscriber-progress-summary",200767989).cljs$core$IFn$_invoke$arity$1(report)], null),new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078),new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(harness)], null);
var G__1927__$1 = ((include_parsed_QMARK_)?cljs.core.assoc.call(null,G__1927,new cljs.core.Keyword(null,"parsed","parsed",-819589156),new cljs.core.Keyword(null,"parsed-tree","parsed-tree",1040023394).cljs$core$IFn$_invoke$arity$1(harness)):G__1927);
if(include_enriched_QMARK_){
return cljs.core.assoc.call(null,G__1927__$1,new cljs.core.Keyword(null,"enriched","enriched",-750799869),new cljs.core.Keyword(null,"annotated-tree","annotated-tree",262346771).cljs$core$IFn$_invoke$arity$1(harness));
} else {
return G__1927__$1;
}
})();
var ___$1 = org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"parse-enrich-validate:before-clj-to-js",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),cljs.core.count.call(null,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(harness)),new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),cljs.core.count.call(null,new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110).cljs$core$IFn$_invoke$arity$1(report))], null));
var result = cljs.core.clj__GT_js.call(null,payload);
var report_json = cljs.core.clj__GT_js.call(null,report);
var ___$2 = (result["report"] = report_json);
var ___$3 = (result["subscriber-statuses"] = (report_json["subscriber-statuses"]));
var ___$4 = org.kp.kpmc.parser.log_memory_BANG_.call(null,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409).cljs$core$IFn$_invoke$arity$1(opts),"parse-enrich-validate:after-clj-to-js",new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"finding-count","finding-count",1557784662),cljs.core.count.call(null,new cljs.core.Keyword(null,"invalid-findings","invalid-findings",1652258078).cljs$core$IFn$_invoke$arity$1(harness)),new cljs.core.Keyword(null,"subscriber-status-count","subscriber-status-count",-2039115136),cljs.core.count.call(null,new cljs.core.Keyword(null,"subscriber-statuses","subscriber-statuses",1485859110).cljs$core$IFn$_invoke$arity$1(report))], null));
return result;
});
org.kp.kpmc.core.structural_provenance_keys = new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 5, [new cljs.core.Keyword(null,"structural-loop-path","structural-loop-path",2642849),null,new cljs.core.Keyword(null,"structural-loop-name","structural-loop-name",219731880),null,new cljs.core.Keyword(null,"loop-resolution","loop-resolution",-1639061591),null,new cljs.core.Keyword(null,"loop-selection-strategy","loop-selection-strategy",1654697327),null,new cljs.core.Keyword(null,"structural-evaluation","structural-evaluation",1284846932),null], null), null);
org.kp.kpmc.core.strip_structural_provenance = (function org$kp$kpmc$core$strip_structural_provenance(value){
if(cljs.core.map_QMARK_.call(null,value)){
return cljs.core.reduce_kv.call(null,(function (result,key,item){
if(cljs.core.contains_QMARK_.call(null,org.kp.kpmc.core.structural_provenance_keys,key)){
return result;
} else {
return cljs.core.assoc.call(null,result,key,org.kp.kpmc.core.strip_structural_provenance.call(null,item));
}
}),cljs.core.empty.call(null,value),value);
} else {
if(cljs.core.vector_QMARK_.call(null,value)){
return cljs.core.mapv.call(null,org.kp.kpmc.core.strip_structural_provenance,value);
} else {
if(cljs.core.sequential_QMARK_.call(null,value)){
return cljs.core.map.call(null,org.kp.kpmc.core.strip_structural_provenance,value);
} else {
return value;

}
}
}
});
/**
 * One-step API for Node consumers.
 * Returns parsed tree, enriched tree, and validation summary JSON-friendly payload.
 */
org.kp.kpmc.core.parse_enrich_validate_json = (function org$kp$kpmc$core$parse_enrich_validate_json(companion_csv,edi_file,opts_json){
var opts = org.kp.kpmc.core.normalize_rule_harness_opts.call(null,(((!((opts_json == null))))?cljs.core.js__GT_clj.call(null,opts_json,new cljs.core.Keyword(null,"keywordize-keys","keywordize-keys",1310784252),true):cljs.core.PersistentArrayMap.EMPTY));
var harness = org.kp.kpmc.companion_rules.run_rule_harness.call(null,companion_csv,edi_file,opts);
return org.kp.kpmc.core.rule_harness_result_json.call(null,harness,opts);
});
/**
 * Structural 834 validation with the same public payload shape as parse-enrich-validate-json.
 */
org.kp.kpmc.core.parse_enrich_validate_structural_json = (function org$kp$kpmc$core$parse_enrich_validate_structural_json(companion_csv,edi_file,opts_json){
var opts = org.kp.kpmc.core.normalize_rule_harness_opts.call(null,(((!((opts_json == null))))?cljs.core.js__GT_clj.call(null,opts_json,new cljs.core.Keyword(null,"keywordize-keys","keywordize-keys",1310784252),true):cljs.core.PersistentArrayMap.EMPTY));
var harness = org.kp.kpmc.core.strip_structural_provenance.call(null,org.kp.kpmc.structural_validation.run_structural_rule_harness.call(null,companion_csv,edi_file,opts));
return org.kp.kpmc.core.rule_harness_result_json.call(null,harness,opts);
});
org.kp.kpmc.core.validate_editable_companion_guide_json = (function org$kp$kpmc$core$validate_editable_companion_guide_json(editable_document_json,edi_file,opts_json){
var document__$1 = cljs.core.js__GT_clj.call(null,editable_document_json,new cljs.core.Keyword(null,"keywordize-keys","keywordize-keys",1310784252),true);
var validation = org.kp.kpmc.companion_rules.validate_editable_document.call(null,document__$1);
if(cljs.core.truth_(new cljs.core.Keyword(null,"valid?","valid?",-212412379).cljs$core$IFn$_invoke$arity$1(validation))){
} else {
var error_1928 = (new Error("Editable companion guide is invalid"));
(error_1928.type = "invalid-editable-companion-guide");

(error_1928.details = cljs.core.clj__GT_js.call(null,new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"diagnostics","diagnostics",359783524),cljs.core.mapv.call(null,org.kp.kpmc.companion_rules.diagnostic__GT_public,new cljs.core.Keyword(null,"diagnostics","diagnostics",359783524).cljs$core$IFn$_invoke$arity$1(validation))], null)));

throw error_1928;
}

var opts = org.kp.kpmc.core.normalize_rule_harness_opts.call(null,(((!((opts_json == null))))?cljs.core.js__GT_clj.call(null,opts_json,new cljs.core.Keyword(null,"keywordize-keys","keywordize-keys",1310784252),true):cljs.core.PersistentArrayMap.EMPTY));
var harness = org.kp.kpmc.companion_rules.run_rule_harness.call(null,new cljs.core.Keyword(null,"model","model",331153215).cljs$core$IFn$_invoke$arity$1(validation),edi_file,opts);
return org.kp.kpmc.core.rule_harness_result_json.call(null,harness,opts);
});
org.kp.kpmc.core.parse_cli_opts = org.kp.kpmc.cli.parse_cli_opts;
org.kp.kpmc.core.cli_usage = org.kp.kpmc.cli.cli_usage;
org.kp.kpmc.core.require_opt = org.kp.kpmc.cli.require_opt;
org.kp.kpmc.core.run_cli_BANG_ = org.kp.kpmc.cli.run_cli_BANG_;
org.kp.kpmc.core._main = (function org$kp$kpmc$core$_main(var_args){
var args__5882__auto__ = [];
var len__5876__auto___1930 = arguments.length;
var i__5877__auto___1931 = (0);
while(true){
if((i__5877__auto___1931 < len__5876__auto___1930)){
args__5882__auto__.push((arguments[i__5877__auto___1931]));

var G__1932 = (i__5877__auto___1931 + (1));
i__5877__auto___1931 = G__1932;
continue;
} else {
}
break;
}

var argseq__5883__auto__ = ((((0) < args__5882__auto__.length))?(new cljs.core.IndexedSeq(args__5882__auto__.slice((0)),(0),null)):null);
return org.kp.kpmc.core._main.cljs$core$IFn$_invoke$arity$variadic(argseq__5883__auto__);
});

(org.kp.kpmc.core._main.cljs$core$IFn$_invoke$arity$variadic = (function (args){
return cljs.core.apply.call(null,org.kp.kpmc.cli._main,args);
}));

(org.kp.kpmc.core._main.cljs$lang$maxFixedArity = (0));

/** @this {Function} */
(org.kp.kpmc.core._main.cljs$lang$applyTo = (function (seq1929){
var self__5862__auto__ = this;
return self__5862__auto__.cljs$core$IFn$_invoke$arity$variadic(cljs.core.seq.call(null,seq1929));
}));

(cljs.core._STAR_main_cli_fn_STAR_ = org.kp.kpmc.core._main);

//# sourceMappingURL=core.js.map
