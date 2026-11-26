// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('org.kp.kpmc.cli');
goog.require('cljs.core');
goog.require('clojure.string');
goog.require('cljs.reader');
goog.require('org.kp.kpmc.io_node');
goog.require('org.kp.kpmc.parser');
goog.require('org.kp.kpmc.enrich');
goog.require('org.kp.kpmc.mapping_export');
/**
 * Parse simple --key value CLI pairs into an option map.
 */
org.kp.kpmc.cli.parse_cli_opts = (function org$kp$kpmc$cli$parse_cli_opts(args){
var remaining = args;
var opts = cljs.core.PersistentArrayMap.EMPTY;
while(true){
if(cljs.core.empty_QMARK_.call(null,remaining)){
return opts;
} else {
var k = cljs.core.first.call(null,remaining);
if(cljs.core._EQ_.call(null,k,"--help")){
return cljs.core.assoc.call(null,opts,new cljs.core.Keyword(null,"help","help",-439233446),true);
} else {
if(cljs.core.truth_((function (){var and__5140__auto__ = clojure.string.starts_with_QMARK_.call(null,k,"--");
if(and__5140__auto__){
return cljs.core.second.call(null,remaining);
} else {
return and__5140__auto__;
}
})())){
var G__2141 = cljs.core.nnext.call(null,remaining);
var G__2142 = cljs.core.assoc.call(null,opts,cljs.core.keyword.call(null,cljs.core.subs.call(null,k,(2))),cljs.core.second.call(null,remaining));
remaining = G__2141;
opts = G__2142;
continue;
} else {
var G__2143 = cljs.core.rest.call(null,remaining);
var G__2144 = opts;
remaining = G__2143;
opts = G__2144;
continue;

}
}
}
break;
}
});
org.kp.kpmc.cli.cli_usage = (function org$kp$kpmc$cli$cli_usage(){
return (""+"Usage:\n"+"  --mode parse-full --input <x12-file> --output <edn-file>\n"+"  --mode parse-chunked --input <x12-file> --output <edn-file>\n"+"  --mode enrich-edn --parse-edn <input-edn> --companion <companion-edn> --output <edn-file>\n"+"  --mode parse-and-enrich --input <x12-file> --companion <companion-edn> --output <edn-file>\n"+"  --mode generate-lookup-specs --input <mapping-edn> --output <lookup-edn>\n"+"\n"+"Examples:\n"+"  --mode parse-full --input src/main/resources/edisamples/test1.txt --output out/full.edn\n"+"  --mode parse-and-enrich --input src/main/resources/edisamples/test1.txt --companion src/main/resources/TrentonSystemsInc_GA_CompanionDoc_5010a1-2025-12-29.edn --output out/enriched.edn\n");
});
org.kp.kpmc.cli.require_opt = (function org$kp$kpmc$cli$require_opt(opts,k){
var or__5142__auto__ = cljs.core.get.call(null,opts,k);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
throw cljs.core.ex_info.call(null,(""+"Missing required option: "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.name.call(null,k))),new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"missing-option","missing-option",-1444028780),new cljs.core.Keyword(null,"option","option",65132272),k,new cljs.core.Keyword(null,"opts","opts",155075701),opts], null));
}
});
org.kp.kpmc.cli.parse_bool = (function org$kp$kpmc$cli$parse_bool(v){
return cljs.core.contains_QMARK_.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 4, ["yes",null,"true",null,"on",null,"1",null], null), null),clojure.string.lower_case.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(v))));
});
/**
 * Execute CLI operation and return {:mode ... :output ... :result ...}.
 */
org.kp.kpmc.cli.run_cli_BANG_ = (function org$kp$kpmc$cli$run_cli_BANG_(opts){
var mode = cljs.core.keyword.call(null,(function (){var or__5142__auto__ = new cljs.core.Keyword(null,"mode","mode",654403691).cljs$core$IFn$_invoke$arity$1(opts);
if(cljs.core.truth_(or__5142__auto__)){
return or__5142__auto__;
} else {
return "";
}
})());
var output = org.kp.kpmc.cli.require_opt.call(null,opts,new cljs.core.Keyword(null,"output","output",-1105869043));
var parse_opts = (function (){var G__2145 = cljs.core.PersistentArrayMap.EMPTY;
var G__2145__$1 = ((cljs.core.contains_QMARK_.call(null,opts,new cljs.core.Keyword(null,"log-memory","log-memory",-1517671152)))?cljs.core.assoc.call(null,G__2145,new cljs.core.Keyword(null,"log-memory?","log-memory?",-916293409),org.kp.kpmc.cli.parse_bool.call(null,new cljs.core.Keyword(null,"log-memory","log-memory",-1517671152).cljs$core$IFn$_invoke$arity$1(opts))):G__2145);
if(cljs.core.contains_QMARK_.call(null,opts,new cljs.core.Keyword(null,"log-every-n-subscribers","log-every-n-subscribers",-1814821737))){
return cljs.core.assoc.call(null,G__2145__$1,new cljs.core.Keyword(null,"log-every-n-subscribers","log-every-n-subscribers",-1814821737),parseInt((""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(new cljs.core.Keyword(null,"log-every-n-subscribers","log-every-n-subscribers",-1814821737).cljs$core$IFn$_invoke$arity$1(opts))),(10)));
} else {
return G__2145__$1;
}
})();
var G__2146 = mode;
var G__2146__$1 = (((G__2146 instanceof cljs.core.Keyword))?G__2146.fqn:null);
switch (G__2146__$1) {
case "parse-full":
var input = org.kp.kpmc.cli.require_opt.call(null,opts,new cljs.core.Keyword(null,"input","input",556931961));
var result = org.kp.kpmc.parser.parse_x12_full.call(null,input,parse_opts);
org.kp.kpmc.io_node.write_text.call(null,output,org.kp.kpmc.io_node.to_edn_text.call(null,result));

return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"mode","mode",654403691),mode,new cljs.core.Keyword(null,"output","output",-1105869043),output,new cljs.core.Keyword(null,"result","result",1415092211),result], null);

break;
case "parse-chunked":
var input = org.kp.kpmc.cli.require_opt.call(null,opts,new cljs.core.Keyword(null,"input","input",556931961));
var result = org.kp.kpmc.parser.parse_x12_chunked.call(null,input,parse_opts);
org.kp.kpmc.io_node.write_text.call(null,output,org.kp.kpmc.io_node.to_edn_text.call(null,result));

return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"mode","mode",654403691),mode,new cljs.core.Keyword(null,"output","output",-1105869043),output,new cljs.core.Keyword(null,"result","result",1415092211),result], null);

break;
case "enrich-edn":
var parse_edn = org.kp.kpmc.cli.require_opt.call(null,opts,new cljs.core.Keyword(null,"parse-edn","parse-edn",-1015752713));
var companion_edn = org.kp.kpmc.cli.require_opt.call(null,opts,new cljs.core.Keyword(null,"companion","companion",-1918453913));
var result = org.kp.kpmc.enrich.enrich_x12_with_companion_guide.call(null,parse_edn,companion_edn);
org.kp.kpmc.io_node.write_text.call(null,output,org.kp.kpmc.io_node.to_edn_text.call(null,result));

return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"mode","mode",654403691),mode,new cljs.core.Keyword(null,"output","output",-1105869043),output,new cljs.core.Keyword(null,"result","result",1415092211),result], null);

break;
case "parse-and-enrich":
var input = org.kp.kpmc.cli.require_opt.call(null,opts,new cljs.core.Keyword(null,"input","input",556931961));
var companion_edn = org.kp.kpmc.cli.require_opt.call(null,opts,new cljs.core.Keyword(null,"companion","companion",-1918453913));
var parsed = org.kp.kpmc.parser.parse_x12_full.call(null,input);
var companion_guide = cljs.reader.read_string.call(null,org.kp.kpmc.io_node.read_text.call(null,companion_edn));
var result = org.kp.kpmc.enrich.enrich_parse_tree.call(null,parsed,companion_guide);
org.kp.kpmc.io_node.write_text.call(null,output,org.kp.kpmc.io_node.to_edn_text.call(null,result));

return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"mode","mode",654403691),mode,new cljs.core.Keyword(null,"output","output",-1105869043),output,new cljs.core.Keyword(null,"result","result",1415092211),result], null);

break;
case "generate-lookup-specs":
var input = org.kp.kpmc.cli.require_opt.call(null,opts,new cljs.core.Keyword(null,"input","input",556931961));
var result = org.kp.kpmc.mapping_export.write_lookup_specs_BANG_.call(null,input,output);
return new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"mode","mode",654403691),mode,new cljs.core.Keyword(null,"output","output",-1105869043),output,new cljs.core.Keyword(null,"result","result",1415092211),result], null);

break;
default:
throw cljs.core.ex_info.call(null,"Invalid or missing --mode",new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"error","error",-978969032),new cljs.core.Keyword(null,"invalid-mode","invalid-mode",-1669506632),new cljs.core.Keyword(null,"mode","mode",654403691),new cljs.core.Keyword(null,"mode","mode",654403691).cljs$core$IFn$_invoke$arity$1(opts),new cljs.core.Keyword(null,"allowed","allowed",1436019743),new cljs.core.PersistentVector(null, 5, 5, cljs.core.PersistentVector.EMPTY_NODE, [new cljs.core.Keyword(null,"parse-full","parse-full",-118711963),new cljs.core.Keyword(null,"parse-chunked","parse-chunked",-1259033613),new cljs.core.Keyword(null,"enrich-edn","enrich-edn",-900218550),new cljs.core.Keyword(null,"parse-and-enrich","parse-and-enrich",346385515),new cljs.core.Keyword(null,"generate-lookup-specs","generate-lookup-specs",-2127590365)], null)], null));

}
});
/**
 * Node CLI entrypoint for parse/enrich operations.
 */
org.kp.kpmc.cli._main = (function org$kp$kpmc$cli$_main(var_args){
var args__5882__auto__ = [];
var len__5876__auto___2151 = arguments.length;
var i__5877__auto___2152 = (0);
while(true){
if((i__5877__auto___2152 < len__5876__auto___2151)){
args__5882__auto__.push((arguments[i__5877__auto___2152]));

var G__2153 = (i__5877__auto___2152 + (1));
i__5877__auto___2152 = G__2153;
continue;
} else {
}
break;
}

var argseq__5883__auto__ = ((((0) < args__5882__auto__.length))?(new cljs.core.IndexedSeq(args__5882__auto__.slice((0)),(0),null)):null);
return org.kp.kpmc.cli._main.cljs$core$IFn$_invoke$arity$variadic(argseq__5883__auto__);
});

(org.kp.kpmc.cli._main.cljs$core$IFn$_invoke$arity$variadic = (function (args){
var opts = org.kp.kpmc.cli.parse_cli_opts.call(null,args);
if(cljs.core.truth_(new cljs.core.Keyword(null,"help","help",-439233446).cljs$core$IFn$_invoke$arity$1(opts))){
cljs.core.println.call(null,org.kp.kpmc.cli.cli_usage.call(null));

return process.exit((0));
} else {
try{var map__2150 = org.kp.kpmc.cli.run_cli_BANG_.call(null,opts);
var map__2150__$1 = cljs.core.__destructure_map.call(null,map__2150);
var mode = cljs.core.get.call(null,map__2150__$1,new cljs.core.Keyword(null,"mode","mode",654403691));
var output = cljs.core.get.call(null,map__2150__$1,new cljs.core.Keyword(null,"output","output",-1105869043));
cljs.core.println.call(null,(""+"Completed "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.name.call(null,mode))+". Wrote "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(output)));

return process.exit((0));
}catch (e2149){var e = e2149;
cljs.core.println.call(null,"CLI error:",e.message);

var temp__5825__auto___2154 = cljs.core.ex_data.call(null,e);
if(cljs.core.truth_(temp__5825__auto___2154)){
var data_2155 = temp__5825__auto___2154;
cljs.core.println.call(null,org.kp.kpmc.io_node.to_edn_text.call(null,data_2155));
} else {
}

cljs.core.println.call(null,org.kp.kpmc.cli.cli_usage.call(null));

return process.exit((1));
}}
}));

(org.kp.kpmc.cli._main.cljs$lang$maxFixedArity = (0));

/** @this {Function} */
(org.kp.kpmc.cli._main.cljs$lang$applyTo = (function (seq2148){
var self__5862__auto__ = this;
return self__5862__auto__.cljs$core$IFn$_invoke$arity$variadic(cljs.core.seq.call(null,seq2148));
}));


//# sourceMappingURL=cli.js.map
