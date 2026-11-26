// Compiled by ClojureScript 1.12.134 {:target :nodejs, :nodejs-rt true, :optimizations :none}
goog.provide('instaparse.print');
goog.require('cljs.core');
goog.require('clojure.string');
instaparse.print.paren_for_tags = (function instaparse$print$paren_for_tags(tag_set,hidden_QMARK_,parser){
if(cljs.core.truth_((function (){var and__5140__auto__ = cljs.core.not.call(null,hidden_QMARK_);
if(and__5140__auto__){
return tag_set.call(null,parser.call(null,new cljs.core.Keyword(null,"tag","tag",-1290361223)));
} else {
return and__5140__auto__;
}
})())){
return (""+"("+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.combinators__GT_str.call(null,parser,false))+")");
} else {
return instaparse.print.combinators__GT_str.call(null,parser,false);
}
});
instaparse.print.paren_for_compound = cljs.core.partial.call(null,instaparse.print.paren_for_tags,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 3, [new cljs.core.Keyword(null,"cat","cat",-1457810207),null,new cljs.core.Keyword(null,"ord","ord",1142548323),null,new cljs.core.Keyword(null,"alt","alt",-3214426),null], null), null));
/**
 * Replaces whitespace characters with escape sequences for better printing
 */
instaparse.print.regexp_replace = (function instaparse$print$regexp_replace(s){
var G__1031 = s;
switch (G__1031) {
case "\n":
return "\\n";

break;
case "\b":
return "\\b";

break;
case "\f":
return "\\f";

break;
case "\r":
return "\\r";

break;
case "\t":
return "\\t";

break;
default:
return s;

}
});
instaparse.print.regexp__GT_str = (function instaparse$print$regexp__GT_str(r){
return clojure.string.replace.call(null,(""+"#\""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.subs.call(null,r.source,(1)))+"\""),/[\s]/,instaparse.print.regexp_replace);
});
instaparse.print.number__GT_hex_padded = (function instaparse$print$number__GT_hex_padded(n){
if((n <= (4095))){
return (""+"0000"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(n.toString((16)))).substr((-4));
} else {
return n.toString((16));
}
});

instaparse.print.char_range__GT_str = (function instaparse$print$char_range__GT_str(p__1033){
var map__1034 = p__1033;
var map__1034__$1 = cljs.core.__destructure_map.call(null,map__1034);
var lo = cljs.core.get.call(null,map__1034__$1,new cljs.core.Keyword(null,"lo","lo",-931799889));
var hi = cljs.core.get.call(null,map__1034__$1,new cljs.core.Keyword(null,"hi","hi",-1821422114));
if(cljs.core._EQ_.call(null,lo,hi)){
return (""+"%x"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.number__GT_hex_padded.call(null,lo)));
} else {
return (""+"%x"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.number__GT_hex_padded.call(null,lo))+"-"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.number__GT_hex_padded.call(null,hi)));
}
});
/**
 * Stringifies a parser built from combinators
 */
instaparse.print.combinators__GT_str = (function instaparse$print$combinators__GT_str(var_args){
var G__1036 = arguments.length;
switch (G__1036) {
case 1:
return instaparse.print.combinators__GT_str.cljs$core$IFn$_invoke$arity$1((arguments[(0)]));

break;
case 2:
return instaparse.print.combinators__GT_str.cljs$core$IFn$_invoke$arity$2((arguments[(0)]),(arguments[(1)]));

break;
default:
throw (new Error(["Invalid arity: ",arguments.length].join("")));

}
});

(instaparse.print.combinators__GT_str.cljs$core$IFn$_invoke$arity$1 = (function (p){
return instaparse.print.combinators__GT_str.call(null,p,false);
}));

(instaparse.print.combinators__GT_str.cljs$core$IFn$_invoke$arity$2 = (function (p__1037,hidden_QMARK_){
var map__1038 = p__1037;
var map__1038__$1 = cljs.core.__destructure_map.call(null,map__1038);
var p = map__1038__$1;
var parser = cljs.core.get.call(null,map__1038__$1,new cljs.core.Keyword(null,"parser","parser",-1543495310));
var parser1 = cljs.core.get.call(null,map__1038__$1,new cljs.core.Keyword(null,"parser1","parser1",-439601422));
var parser2 = cljs.core.get.call(null,map__1038__$1,new cljs.core.Keyword(null,"parser2","parser2",1013754688));
var parsers = cljs.core.get.call(null,map__1038__$1,new cljs.core.Keyword(null,"parsers","parsers",-804353827));
var tag = cljs.core.get.call(null,map__1038__$1,new cljs.core.Keyword(null,"tag","tag",-1290361223));
if(cljs.core.truth_((function (){var and__5140__auto__ = cljs.core.not.call(null,hidden_QMARK_);
if(and__5140__auto__){
return new cljs.core.Keyword(null,"hide","hide",-596913169).cljs$core$IFn$_invoke$arity$1(p);
} else {
return and__5140__auto__;
}
})())){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1("<")+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.combinators__GT_str.call(null,p,true))+cljs.core.str.cljs$core$IFn$_invoke$arity$1(">"));
} else {
var G__1039 = tag;
var G__1039__$1 = (((G__1039 instanceof cljs.core.Keyword))?G__1039.fqn:null);
switch (G__1039__$1) {
case "epsilon":
return "\u03B5";

break;
case "opt":
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.paren_for_compound.call(null,hidden_QMARK_,parser))+"?");

break;
case "plus":
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.paren_for_compound.call(null,hidden_QMARK_,parser))+"+");

break;
case "star":
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.paren_for_compound.call(null,hidden_QMARK_,parser))+"*");

break;
case "rep":
if(cljs.core.not_EQ_.call(null,new cljs.core.Keyword(null,"min","min",444991522).cljs$core$IFn$_invoke$arity$1(p),new cljs.core.Keyword(null,"max","max",61366548).cljs$core$IFn$_invoke$arity$1(p))){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.paren_for_compound.call(null,hidden_QMARK_,parser))+cljs.core.str.cljs$core$IFn$_invoke$arity$1("{")+cljs.core.str.cljs$core$IFn$_invoke$arity$1(new cljs.core.Keyword(null,"min","min",444991522).cljs$core$IFn$_invoke$arity$1(p))+cljs.core.str.cljs$core$IFn$_invoke$arity$1(",")+cljs.core.str.cljs$core$IFn$_invoke$arity$1(new cljs.core.Keyword(null,"max","max",61366548).cljs$core$IFn$_invoke$arity$1(p))+cljs.core.str.cljs$core$IFn$_invoke$arity$1("}"));
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.paren_for_compound.call(null,hidden_QMARK_,parser))+cljs.core.str.cljs$core$IFn$_invoke$arity$1("{")+cljs.core.str.cljs$core$IFn$_invoke$arity$1(new cljs.core.Keyword(null,"min","min",444991522).cljs$core$IFn$_invoke$arity$1(p))+cljs.core.str.cljs$core$IFn$_invoke$arity$1("}"));
}

break;
case "alt":
return clojure.string.join.call(null," | ",cljs.core.map.call(null,cljs.core.partial.call(null,instaparse.print.paren_for_tags,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"ord","ord",1142548323),null], null), null),hidden_QMARK_),parsers));

break;
case "ord":
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.paren_for_tags.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"alt","alt",-3214426),null], null), null),hidden_QMARK_,parser1))+" / "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.paren_for_tags.call(null,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 1, [new cljs.core.Keyword(null,"alt","alt",-3214426),null], null), null),hidden_QMARK_,parser2)));

break;
case "cat":
return clojure.string.join.call(null," ",cljs.core.map.call(null,cljs.core.partial.call(null,instaparse.print.paren_for_tags,new cljs.core.PersistentHashSet(null, new cljs.core.PersistentArrayMap(null, 2, [new cljs.core.Keyword(null,"ord","ord",1142548323),null,new cljs.core.Keyword(null,"alt","alt",-3214426),null], null), null),hidden_QMARK_),parsers));

break;
case "string":
var sb__5795__auto__ = (new goog.string.StringBuffer());
var _STAR_print_newline_STAR__orig_val__1040_1050 = cljs.core._STAR_print_newline_STAR_;
var _STAR_print_fn_STAR__orig_val__1041_1051 = cljs.core._STAR_print_fn_STAR_;
var _STAR_print_newline_STAR__temp_val__1042_1052 = true;
var _STAR_print_fn_STAR__temp_val__1043_1053 = (function (x__5796__auto__){
return sb__5795__auto__.append(x__5796__auto__);
});
(cljs.core._STAR_print_newline_STAR_ = _STAR_print_newline_STAR__temp_val__1042_1052);

(cljs.core._STAR_print_fn_STAR_ = _STAR_print_fn_STAR__temp_val__1043_1053);

try{cljs.core.pr.call(null,new cljs.core.Keyword(null,"string","string",-1989541586).cljs$core$IFn$_invoke$arity$1(p));
}finally {(cljs.core._STAR_print_fn_STAR_ = _STAR_print_fn_STAR__orig_val__1041_1051);

(cljs.core._STAR_print_newline_STAR_ = _STAR_print_newline_STAR__orig_val__1040_1050);
}
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(sb__5795__auto__));

break;
case "string-ci":
var sb__5795__auto__ = (new goog.string.StringBuffer());
var _STAR_print_newline_STAR__orig_val__1044_1054 = cljs.core._STAR_print_newline_STAR_;
var _STAR_print_fn_STAR__orig_val__1045_1055 = cljs.core._STAR_print_fn_STAR_;
var _STAR_print_newline_STAR__temp_val__1046_1056 = true;
var _STAR_print_fn_STAR__temp_val__1047_1057 = (function (x__5796__auto__){
return sb__5795__auto__.append(x__5796__auto__);
});
(cljs.core._STAR_print_newline_STAR_ = _STAR_print_newline_STAR__temp_val__1046_1056);

(cljs.core._STAR_print_fn_STAR_ = _STAR_print_fn_STAR__temp_val__1047_1057);

try{cljs.core.pr.call(null,new cljs.core.Keyword(null,"string","string",-1989541586).cljs$core$IFn$_invoke$arity$1(p));
}finally {(cljs.core._STAR_print_fn_STAR_ = _STAR_print_fn_STAR__orig_val__1045_1055);

(cljs.core._STAR_print_newline_STAR_ = _STAR_print_newline_STAR__orig_val__1044_1054);
}
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(sb__5795__auto__));

break;
case "char":
return instaparse.print.char_range__GT_str.call(null,p);

break;
case "regexp":
return instaparse.print.regexp__GT_str.call(null,new cljs.core.Keyword(null,"regexp","regexp",-541372782).cljs$core$IFn$_invoke$arity$1(p));

break;
case "nt":
return cljs.core.subs.call(null,(""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(new cljs.core.Keyword(null,"keyword","keyword",811389747).cljs$core$IFn$_invoke$arity$1(p))),(1));

break;
case "look":
return (""+"&"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.paren_for_compound.call(null,hidden_QMARK_,parser)));

break;
case "neg":
return (""+"!"+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.paren_for_compound.call(null,hidden_QMARK_,parser)));

break;
default:
throw (new Error((""+"No matching clause: "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(G__1039__$1))));

}
}
}));

(instaparse.print.combinators__GT_str.cljs$lang$maxFixedArity = 2);

/**
 * Takes a non-terminal symbol and a parser built from combinators,
 * and returns a string for the rule.
 */
instaparse.print.rule__GT_str = (function instaparse$print$rule__GT_str(non_terminal,parser){
if(cljs.core._EQ_.call(null,new cljs.core.Keyword(null,"reduction-type","reduction-type",-488293450).cljs$core$IFn$_invoke$arity$1(new cljs.core.Keyword(null,"red","red",-969428204).cljs$core$IFn$_invoke$arity$1(parser)),new cljs.core.Keyword(null,"raw","raw",1604651272))){
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1("<")+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.name.call(null,non_terminal))+cljs.core.str.cljs$core$IFn$_invoke$arity$1(">")+" = "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.combinators__GT_str.call(null,parser)));
} else {
return (""+cljs.core.str.cljs$core$IFn$_invoke$arity$1(cljs.core.name.call(null,non_terminal))+" = "+cljs.core.str.cljs$core$IFn$_invoke$arity$1(instaparse.print.combinators__GT_str.call(null,parser)));
}
});
/**
 * Takes a Parser object, i.e., something with a grammar map and a start 
 * production keyword, and stringifies it.
 */
instaparse.print.Parser__GT_str = (function instaparse$print$Parser__GT_str(p__1058){
var map__1059 = p__1058;
var map__1059__$1 = cljs.core.__destructure_map.call(null,map__1059);
var grammar = cljs.core.get.call(null,map__1059__$1,new cljs.core.Keyword(null,"grammar","grammar",1881328267));
var start = cljs.core.get.call(null,map__1059__$1,new cljs.core.Keyword(null,"start-production","start-production",687546537));
return clojure.string.join.call(null,"\n",cljs.core.cons.call(null,instaparse.print.rule__GT_str.call(null,start,grammar.call(null,start)),(function (){var iter__5628__auto__ = (function instaparse$print$Parser__GT_str_$_iter__1060(s__1061){
return (new cljs.core.LazySeq(null,(function (){
var s__1061__$1 = s__1061;
while(true){
var temp__5825__auto__ = cljs.core.seq.call(null,s__1061__$1);
if(temp__5825__auto__){
var s__1061__$2 = temp__5825__auto__;
if(cljs.core.chunked_seq_QMARK_.call(null,s__1061__$2)){
var c__5626__auto__ = cljs.core.chunk_first.call(null,s__1061__$2);
var size__5627__auto__ = cljs.core.count.call(null,c__5626__auto__);
var b__1063 = cljs.core.chunk_buffer.call(null,size__5627__auto__);
if((function (){var i__1062 = (0);
while(true){
if((i__1062 < size__5627__auto__)){
var vec__1064 = cljs.core._nth.call(null,c__5626__auto__,i__1062);
var non_terminal = cljs.core.nth.call(null,vec__1064,(0),null);
var parser = cljs.core.nth.call(null,vec__1064,(1),null);
if(cljs.core.not_EQ_.call(null,non_terminal,start)){
cljs.core.chunk_append.call(null,b__1063,instaparse.print.rule__GT_str.call(null,non_terminal,parser));

var G__1070 = (i__1062 + (1));
i__1062 = G__1070;
continue;
} else {
var G__1071 = (i__1062 + (1));
i__1062 = G__1071;
continue;
}
} else {
return true;
}
break;
}
})()){
return cljs.core.chunk_cons.call(null,cljs.core.chunk.call(null,b__1063),instaparse$print$Parser__GT_str_$_iter__1060.call(null,cljs.core.chunk_rest.call(null,s__1061__$2)));
} else {
return cljs.core.chunk_cons.call(null,cljs.core.chunk.call(null,b__1063),null);
}
} else {
var vec__1067 = cljs.core.first.call(null,s__1061__$2);
var non_terminal = cljs.core.nth.call(null,vec__1067,(0),null);
var parser = cljs.core.nth.call(null,vec__1067,(1),null);
if(cljs.core.not_EQ_.call(null,non_terminal,start)){
return cljs.core.cons.call(null,instaparse.print.rule__GT_str.call(null,non_terminal,parser),instaparse$print$Parser__GT_str_$_iter__1060.call(null,cljs.core.rest.call(null,s__1061__$2)));
} else {
var G__1072 = cljs.core.rest.call(null,s__1061__$2);
s__1061__$1 = G__1072;
continue;
}
}
} else {
return null;
}
break;
}
}),null,null));
});
return iter__5628__auto__.call(null,grammar);
})()));
});

//# sourceMappingURL=print.js.map
