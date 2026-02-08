export const DEFAULT_CONFIG_JSON = `{
    "systemDict" : "system.dic",
    "enableDefaultCompoundParticles" : true,
    "inputTextPlugin" : [
        { "class" : "com.worksap.nlp.sudachi.DefaultInputTextPlugin" }
    ],
    "oovProviderPlugin" : [
        {
            "class" : "com.worksap.nlp.sudachi.MeCabOovProviderPlugin",
            "charDef" : "char.def",
            "unkDef" : "unk.def"
        },
        {
            "class" : "com.worksap.nlp.sudachi.SimpleOovProviderPlugin",
            "oovPOS" : [ "名詞", "普通名詞", "一般", "*", "*", "*" ],
            "cost" : 30000
        }
    ],
    "pathRewritePlugin" : [
        { "class" : "com.worksap.nlp.sudachi.JoinNumericPlugin" },
        {
            "class" : "com.worksap.nlp.sudachi.JoinKatakanaOovPlugin",
            "oovPOS" : [ "名詞", "普通名詞", "一般", "*", "*", "*" ],
            "minLength" : 3
        }
    ]
}`;
