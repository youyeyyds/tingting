// index.js
const app = getApp();

const MARTIAL_ARTS = [
  { name: "降龙十八掌", type: "掌法", users: ["洪七公","郭靖","乔峰","虚竹"] },
  { name: "打狗棒法", type: "棒法", users: ["洪七公","黄蓉","杨过","鲁有脚","耶律齐"] },
  { name: "九阴真经", type: "内功", users: ["黄裳","郭靖","周伯通","梅超风","陈玄风","洪七公","一灯大师","杨过"] },
  { name: "九阴白骨爪", type: "爪法", users: ["梅超风","陈玄风","周芷若"] },
  { name: "白蟒鞭法", type: "鞭法", users: ["梅超风","陈玄风"] },
  { name: "摧心掌", type: "掌法", users: ["梅超风","陈玄风"] },
  { name: "天罡北斗阵", type: "阵法", users: ["全真七子","丘处机","王处一","郝大通","刘处玄","孙不二","谭处端"] },
  { name: "一气化三清", type: "剑法", users: ["全真七子","尹志平"] },
  { name: "同归剑法", type: "剑法", users: ["全真七子","尹志平","赵志敬"] },
  { name: "金雁功", type: "轻功", users: ["全真七子","周伯通","丘处机","马钰"] },
  { name: "全真内功", type: "内功", users: ["王重阳","全真七子","周伯通","丘处机","马钰"] },
  { name: "全真剑法", type: "剑法", users: ["全真七子","丘处机","尹志平","赵志敬","李志常"] },
  { name: "先天功", type: "内功", users: ["王重阳","一灯大师","周伯通"] },
  { name: "一阳指", type: "指法", users: ["段智兴","一灯大师","段正淳","段誉","段延庆","保定帝"] },
  { name: "兰花拂穴手", type: "指法", users: ["黄药师","黄蓉","程英"] },
  { name: "弹指神通", type: "指法", users: ["黄药师","杨过","黄蓉"] },
  { name: "玉漏银剑", type: "剑法", users: ["黄药师"] },
  { name: "落英神剑掌", type: "掌法", users: ["黄药师"] },
  { name: "桃华落英掌", type: "掌法", users: ["黄药师"] },
  { name: "碧波掌法", type: "掌法", users: ["程英","黄药师"] },
  { name: "旋风扫叶腿", type: "腿法", users: ["黄药师","陆乘风"] },
  { name: "天罡步", type: "步法", users: ["洪七公"] },
  { name: "逍遥游掌法", type: "掌法", users: ["洪七公"] },
  { name: "空明拳", type: "拳法", users: ["周伯通","郭靖"] },
  { name: "左右互搏", type: "功法", users: ["周伯通","小龙女","郭靖"] },
  { name: "三花聚顶掌", type: "掌法", users: ["全真七子"] },
  { name: "泥鳅功", type: "身法", users: ["瑛姑"] },
  { name: "摄魂术", type: "功法", users: ["瑛姑"] },
  { name: "蛤蟆功", type: "内功", users: ["欧阳锋","欧阳克","杨过"] },
  { name: "灵蛇拳法", type: "拳法", users: ["欧阳锋"] },
  { name: "灵蛇杖法", type: "杖法", users: ["欧阳锋","欧阳克"] },
  { name: "逆转经脉", type: "内功", users: ["欧阳锋","杨过","洪七公"] },
  { name: "含沙射影", type: "暗器", users: ["欧阳锋"] },
  { name: "铁掌功", type: "掌法", users: ["裘千仞","裘千丈","裘千尺"] },
  { name: "赤练神掌", type: "掌法", users: ["李莫愁"] },
  { name: "冰魄银针", type: "暗器", users: ["李莫愁","小龙女"] },
  { name: "银梭素光剑", type: "剑法", users: ["李莫愁"] },
  { name: "三无三不手", type: "掌法", users: ["李莫愁"] },
  { name: "五毒神掌", type: "掌法", users: ["何红药"] },
  { name: "五毒秘功", type: "毒术", users: ["蓝凤凰","何铁手"] },
  { name: "金蚕蛊毒", type: "毒术", users: ["蓝凤凰","五毒教"] },
  { name: "龙象般若功", type: "内功", users: ["金轮法王","达尔巴","霍都"] },
  { name: "龙象般若掌", type: "掌法", users: ["金轮法王"] },
  { name: "释迦掷象功", type: "掌法", users: ["尼摩星"] },
  { name: "金丝攀虹鞭法", type: "鞭法", users: ["尹克西"] },
  { name: "惊魂掌", type: "掌法", users: ["潇湘子"] },
  { name: "延年益寿法", type: "内功", users: ["潇湘子"] },
  { name: "白驼山身法", type: "轻功", users: ["欧阳克","欧阳锋"] },
  { name: "透骨打穴法", type: "点穴", users: ["欧阳克"] },
  { name: "漫天花雨撒金针", type: "暗器", users: ["黄蓉"] },
  { name: "妙手空空", type: "技艺", users: ["黄蓉"] },
  { name: "铜尸内功", type: "内功", users: ["陈玄风","梅超风"] },
  { name: "玄门内功", type: "内功", users: ["马钰","丘处机"] },
  { name: "金关玉锁诀", type: "内功", users: ["马钰"] },
  { name: "伏魔杖法", type: "杖法", users: ["柯镇恶"] },
  { name: "八卦方位掌", type: "掌法", users: ["柯镇恶"] },
  { name: "六脉神剑", type: "剑法", users: ["段誉","段思廉"] },
  { name: "北冥神功", type: "内功", users: ["段誉","虚竹","无崖子","任我行"] },
  { name: "凌波微步", type: "轻功", users: ["段誉","洪七公"] },
  { name: "段氏剑法", type: "剑法", users: ["段正淳","段誉","段正明"] },
  { name: "五罗轻烟掌", type: "掌法", users: ["段正淳","秦红棉"] },
  { name: "云南火云掌", type: "掌法", users: ["巴天石"] },
  { name: "参合指", type: "指法", users: ["慕容博","慕容复"] },
  { name: "斗转星移", type: "技艺", users: ["慕容博","慕容复"] },
  { name: "慕容家剑法", type: "剑法", users: ["慕容复","慕容博"] },
  { name: "般若金刚掌", type: "掌法", users: ["玄慈","玄难","玄寂"] },
  { name: "大金刚拳", type: "拳法", users: ["玄慈"] },
  { name: "一拍两散", type: "掌法", users: ["玄慈"] },
  { name: "须弥山掌", type: "掌法", users: ["玄慈"] },
  { name: "千手如来掌", type: "掌法", users: ["方证大师"] },
  { name: "韦陀掌", type: "掌法", users: ["空性","空智"] },
  { name: "龙爪手", type: "指法", users: ["空性","少林僧"] },
  { name: "拈花指", type: "指法", users: ["玄渡","波罗星"] },
  { name: "多罗叶指", type: "指法", users: ["少林僧"] },
  { name: "去烦恼指", type: "指法", users: ["少林僧"] },
  { name: "大智无定指", type: "指法", users: ["少林僧"] },
  { name: "天竺番僧指", type: "指法", users: ["少林僧"] },
  { name: "因陀罗抓", type: "爪法", users: ["少林僧"] },
  { name: "燃木刀法", type: "刀法", users: ["少林僧"] },
  { name: "破衲功", type: "内功", users: ["少林僧"] },
  { name: "金刚不坏体", type: "功法", users: ["空见神僧"] },
  { name: "狮子吼", type: "功法", users: ["空见神僧","谢逊","张三丰"] },
  { name: "金刚指", type: "指法", users: ["少林僧","巴天石"] },
  { name: "擒龙功", type: "技艺", users: ["萧峰","虚竹"] },
  { name: "排云双掌", type: "掌法", users: ["萧峰"] },
  { name: "太祖长拳", type: "拳法", users: ["萧峰","赵钱孙"] },
  { name: "截手匕", type: "指法", users: ["萧峰"] },
  { name: "天山折梅手", type: "擒拿", users: ["天山童姥","虚竹"] },
  { name: "天山六阳掌", type: "掌法", users: ["天山童姥","虚竹"] },
  { name: "八荒六合唯我独尊功", type: "内功", users: ["天山童姥","虚竹"] },
  { name: "生死符", type: "暗器", users: ["天山童姥","虚竹"] },
  { name: "小无相功", type: "内功", users: ["无崖子","李秋水","虚竹","鸠摩智"] },
  { name: "白虹掌力", type: "掌法", users: ["李秋水","无崖子"] },
  { name: "龟息功", type: "内功", users: ["大理段氏"] },
  { name: "五斗米神功", type: "掌法", users: ["不平道人"] },
  { name: "控鹤功", type: "内功", users: ["不平道人","虚竹"] },
  { name: "剥经刀法", type: "刀法", users: ["不平道人"] },
  { name: "火焰刀", type: "刀法", users: ["鸠摩智"] },
  { name: "大摔碑手", type: "掌法", users: ["云中鹤","岳老三"] },
  { name: "穿心锥法", type: "指法", users: ["段延庆"] },
  { name: "腹语术", type: "技艺", users: ["叶二娘"] },
  { name: "化功大法", type: "内功", users: ["丁春秋","游坦之"] },
  { name: "腐尸毒", type: "毒术", users: ["丁春秋","阿紫"] },
  { name: "三笑逍遥散", type: "毒术", users: ["丁春秋","苏星河"] },
  { name: "寒冰真气", type: "内功", users: ["游坦之","任我行"] },
  { name: "神足经", type: "内功", users: ["游坦之"] },
  { name: "玄冥神掌", type: "掌法", users: ["鹤笔翁","鹿杖客","玄冥二老"] },
  { name: "幻阴指", type: "指法", users: ["成昆","圆真"] },
  { name: "混元功", type: "内功", users: ["成昆","谢逊"] },
  { name: "九阳真经", type: "内功", users: ["张无忌","郭襄","觉远","张三丰"] },
  { name: "乾坤大挪移", type: "功法", users: ["张无忌","阳顶天","历代明教教主"] },
  { name: "圣火令神功", type: "功法", users: ["张无忌","波斯三使","流云使","妙风使","辉月使"] },
  { name: "太极拳", type: "拳法", users: ["张三丰","张无忌","俞岱岩"] },
  { name: "太极剑", type: "剑法", users: ["张三丰","张无忌","俞岱岩","殷梨亭"] },
  { name: "武当剑法", type: "剑法", users: ["武当七侠","张翠山","俞莲舟","张松溪"] },
  { name: "武当内功", type: "内功", users: ["武当七侠","张三丰","张翠山"] },
  { name: "梯云纵", type: "轻功", users: ["武当七侠","俞莲舟","张松溪"] },
  { name: "真武七截阵", type: "阵法", users: ["武当七侠"] },
  { name: "神门十三剑", type: "剑法", users: ["张翠山","殷梨亭"] },
  { name: "绕指柔剑", type: "剑法", users: ["张翠山","张无忌"] },
  { name: "玄虚刀法", type: "刀法", users: ["张翠山"] },
  { name: "绵掌", type: "掌法", users: ["武当七侠","张松溪"] },
  { name: "震山掌", type: "掌法", users: ["武当派"] },
  { name: "虎爪手", type: "爪法", users: ["武当派"] },
  { name: "九宫八卦剑", type: "剑法", users: ["武当七侠","张翠山"] },
  { name: "天地同寿", type: "剑法", users: ["殷梨亭"] },
  { name: "金顶绵掌", type: "掌法", users: ["峨眉派"] },
  { name: "峨眉九阳功", type: "内功", users: ["灭绝师太","周芷若","静照师太","丁敏君"] },
  { name: "峨眉剑法", type: "剑法", users: ["灭绝师太","周芷若","纪晓芙","丁敏君"] },
  { name: "灭剑", type: "剑法", users: ["灭绝师太","周芷若"] },
  { name: "绝剑", type: "剑法", users: ["灭绝师太"] },
  { name: "飘絮剑法", type: "剑法", users: ["周芷若"] },
  { name: "峨眉派掌法", type: "掌法", users: ["周芷若","灭绝师太"] },
  { name: "昆仑剑法", type: "剑法", users: ["何太冲","班淑娴","西华子","卫四娘"] },
  { name: "正两仪剑法", type: "剑法", users: ["何太冲","班淑娴"] },
  { name: "两仪剑法", type: "剑法", users: ["何太冲","班淑娴","华山派"] },
  { name: "大地理纬剑法", type: "剑法", users: ["何太冲"] },
  { name: "昆仑派掌法", type: "掌法", users: ["何太冲"] },
  { name: "绵绵掌", type: "掌法", users: ["何太冲"] },
  { name: "截手九式", type: "指法", users: ["灭绝师太"] },
  { name: "七伤拳", type: "拳法", users: ["谢逊","宗维侠","唐文亮","常敬之","崆峒五老"] },
  { name: "崆峒派内功", type: "内功", users: ["崆峒五老","宗维侠"] },
  { name: "寒冰绵掌", type: "掌法", users: ["韦一笑"] },
  { name: "青翼蝠王轻功", type: "轻功", users: ["韦一笑"] },
  { name: "鹰爪擒拿手", type: "指法", users: ["殷天正","殷梨亭"] },
  { name: "两仪刀法", type: "刀法", users: ["杨逍"] },
  { name: "明教内功", type: "内功", users: ["阳顶天","张无忌","杨逍","范遥","殷天正","韦一笑","谢逊"] },
  { name: "明教狮子吼", type: "功法", users: ["谢逊"] },
  { name: "金毛狮王拳", type: "拳法", users: ["谢逊"] },
  { name: "圣火令阵法", type: "阵法", users: ["波斯三使","张无忌"] },
  { name: "金刚伏魔圈", type: "阵法", users: ["少林三渡","张无忌","黄衫女子"] },
  { name: "澄观一指禅", type: "指法", users: ["澄观","方证大师"] },
  { name: "一指禅功", type: "指法", users: ["澄观","方证大师"] },
  { name: "大力金刚指", type: "指法", users: ["澄观","少林僧"] },
  { name: "大金刚掌", type: "掌法", users: ["澄观","玄难"] },
  { name: "化骨绵掌", type: "掌法", users: ["假太后","毛东珠"] },
  { name: "化尸粉", type: "毒术", users: ["洪安通"] },
  { name: "独孤九剑", type: "剑法", users: ["风清扬","令狐冲","独孤求败"] },
  { name: "辟邪剑法", type: "剑法", users: ["岳不群","林平之","东方不败"] },
  { name: "葵花宝典", type: "功法", users: ["东方不败","岳不群","林平之","红叶禅师"] },
  { name: "辟邪剑谱", type: "剑法", users: ["岳不群","林平之"] },
  { name: "紫霞神功", type: "内功", users: ["岳不群","岳灵珊"] },
  { name: "华山剑法", type: "剑法", users: ["岳不群","宁中则","令狐冲","岳灵珊"] },
  { name: "淑女剑法", type: "剑法", users: ["宁中则","岳灵珊"] },
  { name: "宁氏一剑", type: "剑法", users: ["宁中则"] },
  { name: "玉女剑十九式", type: "剑法", users: ["岳灵珊"] },
  { name: "夺命连环三仙剑", type: "剑法", users: ["岳不群","丛不弃"] },
  { name: "太岳三青峰", type: "剑法", users: ["岳不群"] },
  { name: "狂风剑法", type: "剑法", users: ["封不平","丛不弃"] },
  { name: "铁袈裟", type: "刀法", users: ["封不平"] },
  { name: "华山剑宗剑法", type: "剑法", users: ["封不平","丛不弃","成不忧"] },
  { name: "华山混元功", type: "内功", users: ["穆人清","袁承志","归辛树","黄真"] },
  { name: "混元功", type: "内功", users: ["穆人清","袁承志","归辛树","黄真","崔敏"] },
  { name: "伏虎刀法", type: "刀法", users: ["华山派","袁承志"] },
  { name: "养吾剑法", type: "剑法", users: ["华山派","岳不群"] },
  { name: "希夷剑法", type: "剑法", users: ["华山派"] },
  { name: "夺命剑法", type: "剑法", users: ["华山派"] },
  { name: "衡山剑法", type: "剑法", users: ["莫大先生","刘正风","鲁连荣"] },
  { name: "回风落雁剑", type: "剑法", users: ["莫大先生"] },
  { name: "百变千幻衡山云雾十三式", type: "剑法", users: ["莫大先生"] },
  { name: "嵩山剑法", type: "剑法", users: ["左冷禅","陆柏","丁勉","费彬","钟镇","邓八公","沙天江"] },
  { name: "嵩山掌法", type: "掌法", users: ["左冷禅","丁勉","费彬"] },
  { name: "嵩山内功", type: "内功", users: ["左冷禅","嵩山派"] },
  { name: "寒冰真炁", type: "内功", users: ["左冷禅"] },
  { name: "嵩山心法", type: "内功", users: ["嵩山派"] },
  { name: "大嵩阳神掌", type: "掌法", users: ["左冷禅","陆柏"] },
  { name: "泰山剑法", type: "剑法", users: ["玉音子","玉磬子","天门道人","天柏道人"] },
  { name: "岱宗如何", type: "剑法", users: ["泰山派"] },
  { name: "玉井剑法", type: "剑法", users: ["嵩山派"] },
  { name: "叠石剑法", type: "剑法", users: ["泰山派"] },
  { name: "快活三剑法", type: "剑法", users: ["恒山派"] },
  { name: "万花剑法", type: "剑法", users: ["恒山派"] },
  { name: "恒山剑法", type: "剑法", users: ["定闲师太","定逸师太","定静师太","仪琳","仪和","仪清"] },
  { name: "恒山剑阵", type: "阵法", users: ["恒山派"] },
  { name: "绵里藏针剑法", type: "剑法", users: ["恒山派"] },
  { name: "反两仪刀法", type: "刀法", users: ["华山派","何太冲","班淑娴"] },
  { name: "反两仪剑法", type: "剑法", users: ["华山派","何太冲"] },
  { name: "吸星大法", type: "内功", users: ["任我行","令狐冲","向问天","丁春秋"] },
  { name: "日月神功", type: "内功", users: ["任我行","向问天"] },
  { name: "三尸脑神丹", type: "毒术", users: ["任我行","东方不败","任盈盈"] },
  { name: "葵花神功", type: "内功", users: ["东方不败"] },
  { name: "日月身法", type: "轻功", users: ["东方不败","任盈盈"] },
  { name: "太极柔剑", type: "剑法", users: ["武当派"] },
  { name: "八卦游龙掌", type: "掌法", users: ["武当派","王剑英"] },
  { name: "太极长拳", type: "拳法", users: ["武当派"] },
  { name: "流云轻功", type: "轻功", users: ["向问天"] },
  { name: "杀人名医", type: "医术", users: ["平一指"] },
  { name: "五毒心法", type: "内功", users: ["蓝凤凰"] },
  { name: "胡家刀法", type: "刀法", users: ["胡一刀","胡斐","苗人凤"] },
  { name: "苗家剑法", type: "剑法", users: ["苗人凤","田归农","苗若兰"] },
  { name: "四象步法", type: "步法", users: ["胡斐"] },
  { name: "八卦刀法", type: "刀法", users: ["王剑英","王剑杰"] },
  { name: "八卦掌", type: "掌法", users: ["王维钧","王剑英","王剑杰"] },
  { name: "八卦游龙刀法", type: "刀法", users: ["王剑英","王剑杰"] },
  { name: "八极拳", type: "拳法", users: ["商老太","商宝震"] },
  { name: "韦陀棍法", type: "棍法", users: ["少林派","都大锦"] },
  { name: "大韦陀掌", type: "掌法", users: ["少林派"] },
  { name: "二郎拳", type: "拳法", users: ["少林派"] },
  { name: "行意拳", type: "拳法", users: ["少林派"] },
  { name: "燕青拳", type: "拳法", users: ["少林派"] },
  { name: "铁砂掌", type: "掌法", users: ["陆冠英","杨康"] },
  { name: "铜锤换掌", type: "掌法", users: ["商家堡"] },
  { name: "查拳", type: "拳法", users: ["回疆"] },
  { name: "华拳", type: "拳法", users: ["回疆"] },
  { name: "弹腿", type: "腿法", users: ["回疆"] },
  { name: "柔云剑法", type: "剑法", users: ["陈家洛","红花会"] },
  { name: "追魂夺命剑法", type: "剑法", users: ["文泰来","红花会","无尘道长"] },
  { name: "铁琵琶手", type: "指法", users: ["文泰来","红花会","赵半山"] },
  { name: "大擒拿手", type: "指法", users: ["红花会","赵半山"] },
  { name: "三十六式大擒拿手", type: "指法", users: ["红花会","赵半山"] },
  { name: "金钟罩", type: "功法", users: ["陈家洛","红花会群雄"] },
  { name: "八卦掌法", type: "掌法", users: ["红花会","赵半山"] },
  { name: "追风剑法", type: "剑法", users: ["红花会","无尘道长"] },
  { name: "伏魔杖法", type: "杖法", users: ["红花会"] },
  { name: "心意把", type: "掌法", users: ["少林派"] },
  { name: "罗汉伏虎掌", type: "掌法", users: ["少林派"] },
  { name: "连城剑法", type: "剑法", users: ["万震山","戚长发","言达平","狄云","丁典"] },
  { name: "唐诗剑法", type: "剑法", users: ["万震山","戚长发","言达平","狄云"] },
  { name: "神照经", type: "内功", users: ["丁典","狄云"] },
  { name: "血刀经", type: "刀法", users: ["血刀老祖","宝象","狄云","血刀门"] },
  { name: "连城诀内功", type: "内功", users: ["狄云","万震山","戚长发","言达平","丁典"] },
  { name: "躺屍剑法", type: "剑法", users: ["戚长发"] },
  { name: "大挪移法", type: "功法", users: ["言达平"] },
  { name: "太玄经", type: "内功", users: ["石破天","侠客岛","龙岛主","木岛主"] },
  { name: "太玄剑法", type: "剑法", users: ["石破天","侠客岛"] },
  { name: "太玄掌法", type: "掌法", users: ["石破天"] },
  { name: "太玄拳法", type: "拳法", users: ["石破天"] },
  { name: "太玄轻功", type: "轻功", users: ["石破天"] },
  { name: "太玄内功", type: "内功", users: ["石破天"] },
  { name: "太玄刀法", type: "刀法", users: ["石破天"] },
  { name: "碧针清蕊", type: "掌法", users: ["石破天","贝海石"] },
  { name: "雪山剑法", type: "剑法", users: ["白自在","白万剑","石破天","封万里","吉人通"] },
  { name: "金乌刀法", type: "刀法", users: ["白自在","石破天"] },
  { name: "上清拳法", type: "拳法", users: ["贝海石","石清"] },
  { name: "五行内丹功", type: "内功", users: ["贝海石"] },
  { name: "雪山派内功", type: "内功", users: ["白自在","雪山派"] },
  { name: "玄素拳", type: "拳法", users: ["石清","闵柔"] },
  { name: "丁家拳法", type: "拳法", users: ["丁不三","丁当"] },
  { name: "金蛇剑法", type: "剑法", users: ["金蛇郎君","袁承志","夏雪宜"] },
  { name: "金蛇游身掌", type: "掌法", users: ["金蛇郎君","袁承志"] },
  { name: "金蛇锥", type: "暗器", users: ["金蛇郎君","袁承志"] },
  { name: "神行百变", type: "轻功", users: ["木桑道长","袁承志","九难师太","韦小宝"] },
  { name: "铁剑门轻功", type: "轻功", users: ["木桑道长","玉真子","袁承志"] },
  { name: "铁剑门剑法", type: "剑法", users: ["木桑道长","玉真子","袁承志"] },
  { name: "三分剑术", type: "剑法", users: ["袁士霄","陈家洛"] },
  { name: "天池怪侠武学", type: "技艺", users: ["袁士霄","关明梅"] },
  { name: "破玉拳", type: "拳法", users: ["崔敏"] },
  { name: "混元掌", type: "掌法", users: ["华山派","袁承志"] },
  { name: "华山拳法", type: "拳法", users: ["华山派","归辛树"] },
  { name: "伏虎掌", type: "掌法", users: ["华山派"] },
  { name: "沾衣十八跌", type: "技艺", users: ["张无忌","明教"] },
  { name: "武穆歌声", type: "掌法", users: ["黄药师","郭靖"] },
  { name: "落英神剑", type: "剑法", users: ["黄药师","杨过"] },
  { name: "混元霹雳掌", type: "掌法", users: ["成昆"] },
  { name: "岳家散手", type: "掌法", users: ["郭靖","黄蓉"] },
  { name: "铁扇扇法", type: "技法", users: ["胡斐","程灵素"] },
  { name: "安提锅爪法", type: "爪法", users: ["血刀门","宝象"] },
  { name: "大韦陀杵", type: "杵法", users: ["少林派"] },
  { name: "分筋错骨手", type: "擒拿", users: ["少林派","各大派"] },
  { name: "金玉拳法", type: "拳法", users: ["石破天","侠客岛"] },
  { name: "雷动九天", type: "掌法", users: ["杨逍","明教"] },
  { name: "无极玄功拳", type: "拳法", users: ["张无忌","武当派"] },
  { name: "截心掌", type: "掌法", users: ["赵敏","汝阳王府"] },
  { name: "透空步", type: "轻功", users: ["各大派"] },
  { name: "飞凤鞭法", type: "鞭法", users: ["陈家洛","红花会"] },
  { name: "降魔杵法", type: "杵法", users: ["少林派"] },
  { name: "达摩剑法", type: "剑法", users: ["少林派"] },
  { name: "罗汉剑法", type: "剑法", users: ["少林派"] },
  { name: "韦陀杵", type: "杵法", users: ["少林派"] },
  { name: "金钟罩铁布衫", type: "横练", users: ["各大派","少林"] },
  { name: "铁臂功", type: "横练", users: ["各大派"] },
  { name: "朱砂掌", type: "掌法", users: ["石破天","侠客岛"] },
  { name: "阴风刀", type: "刀法", users: ["玄冥二老","鹤笔翁"] },
  { name: "大阴阳手", type: "掌法", users: ["少林派","澄观"] },
  { name: "少林九阳功", type: "内功", users: ["少林派","空闻"] },
  { name: "武当九阳功", type: "内功", users: ["张三丰","武当七侠"] },
  { name: "杨家枪法", type: "枪法", users: ["郭靖","杨过"] },
  { name: "呼延枪法", type: "枪法", users: ["陈家洛","红花会"] },
  { name: "武松脱铐拳", type: "拳法", users: ["袁承志","华山派"] },
  { name: "混水摸鱼拳", type: "拳法", users: ["袁承志","华山派"] },
];

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0,
    scrollHeightNoTab: 0,
    scrollHeightWithTab: 0,
    isLoggedIn: false,
    courses: [],
    headlines: [],
    bannerSpeed: 5000,
    homeProtect: true,
    loading: true,
    activeTab: 0,
    refreshing: false,
    maskedCourses: {},
    bannerTime: 0,
    coverTime: 0,
    logoutConfirmVisible: false // 退出登录确认弹窗
  },

  onLoad() {
    this.initLayout();
    this.initTimes();
    this.initCache();
    this.checkLogin();
  },

  initLayout() {
    const { statusBarHeight, windowHeight, windowWidth } = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    const headerHeight = statusBarHeight + navBarHeight;
    const tabH = 100 * windowWidth / 750; // 100rpx 转 px

    this.setData({
      statusBarHeight,
      navBarHeight,
      headerHeight,
      scrollHeightNoTab: windowHeight - headerHeight,
      scrollHeightWithTab: windowHeight - headerHeight - tabH
    });
  },

  initTimes() {
    if (!app.globalData.bannerLoadTime) app.globalData.bannerLoadTime = Date.now();
    if (!app.globalData.coverLoadTime) app.globalData.coverLoadTime = Date.now();
    if (!app.globalData.homePageMaskedCourses) app.globalData.homePageMaskedCourses = {};

    this.setData({
      bannerTime: app.globalData.bannerLoadTime,
      coverTime: app.globalData.coverLoadTime,
      maskedCourses: app.globalData.homePageMaskedCourses
    });
  },

  initCache() {
    // 优先从本地存储读取缓存，避免空白页
    let headlines = app.globalData.indexHeadlines;
    let courses = app.globalData.indexCourses;

    if (!headlines?.length) {
      headlines = wx.getStorageSync('indexHeadlines') || [];
      app.globalData.indexHeadlines = headlines;
    }
    if (!courses?.length) {
      courses = wx.getStorageSync('indexCourses') || [];
      app.globalData.indexCourses = courses;
    }

    // 如果有缓存，需要用当前时间戳重建 URL
    const bannerTime = app.globalData.bannerLoadTime;
    const coverTime = app.globalData.coverLoadTime;
    if (headlines.length > 0) {
      headlines = headlines.map(h => ({
        ...h,
        image: this.processUrl(h.image, bannerTime, 'banner')
      }));
    }
    if (courses.length > 0) {
      courses = courses.map(c => ({
        ...c,
        cover: this.processUrl(c.cover, coverTime, 'cover')
      }));
    }

    this.setData({
      headlines,
      courses,
      loading: !courses.length // 有缓存则不显示loading
    });

    if (!headlines.length) this.loadHeadlines();
    else this.maskCourses();

    if (!courses.length) this.loadCourses();
  },

  onShow() {
    this.checkLogin();
    this.syncTimes();
    this.showStatusToast();
  },

  syncTimes() {
    const bt = app.globalData.bannerLoadTime;
    const ct = app.globalData.coverLoadTime;

    if (bt !== this.data.bannerTime) {
      const headlines = this.data.headlines.map(h => ({
        ...h, image: this.processUrl(h.image, bt, 'banner')
      }));
      this.setData({ bannerTime: bt, headlines });
      app.globalData.indexHeadlines = headlines; // 同步回全局缓存
    }

    if (ct !== this.data.coverTime) {
      const courses = this.data.courses.map(c => ({
        ...c, cover: this.processUrl(c.cover, ct, 'cover')
      }));
      this.setData({ coverTime: ct, courses });
      app.globalData.indexCourses = courses; // 同步回全局缓存
      this.maskCourses();
    }
  },

  showStatusToast() {
    if (app.globalData.loginFlag) {
      app.globalData.loginFlag = false;
      setTimeout(() => wx.showToast({ title: '已登录', icon: 'success' }), 500);
    } else if (app.globalData.logoutFlag) {
      app.globalData.logoutFlag = false;
      setTimeout(() => wx.showToast({ title: '已退出登录', icon: 'success' }), 500);
    }
  },

  processUrl(url, time, type) {
    if (!url || url.includes('seed/fixed_')) return url;
    const t = time || this.data[type === 'banner' ? 'bannerTime' : 'coverTime'];

    // 已有时间戳格式，更新时间戳
    const m1 = url.match(/seed\/(\d+)_(banner|cover)_([^\/]+)\/(\d+(\/\d+)?)/);
    if (m1 && m1[1] != t) {
      return url.replace(/seed\/\d+_(banner|cover)_/, `seed/${t}_${type}_`);
    }
    if (m1) return url;

    // seed格式（非时间戳），添加时间戳
    const m2 = url.match(/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
    if (m2) return `https://picsum.photos/seed/${t}_${type}_${m2[1]}/${m2[2]}`;

    // 无seed格式
    const m3 = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
    if (m3) {
      const r = url.match(/random=(\d+)/)?.[1] || '0';
      return `https://picsum.photos/seed/${t}_${type}_${r}/${m3[1]}`;
    }

    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
  },

  onRefresh() {
    const t = Date.now();
    app.globalData.bannerLoadTime = t;
    app.globalData.coverLoadTime = t;
    wx.setStorageSync('bannerLoadTime', t);
    wx.setStorageSync('coverLoadTime', t);
    app.globalData.indexHeadlines = [];
    app.globalData.indexCourses = [];
    console.log('[Index] onRefresh, bannerLoadTime:', t);
    // 不再清空其他页面的缓存（loginHeadlines, favoriteHeadlines, mineHeadlines）
    // 各页面通过 onShow 检测 bannerLoadTime 变化来同步图片

    const newMasked = {};
    this.data.courses.forEach(c => newMasked[c._id] = MARTIAL_ARTS[Math.floor(Math.random() * MARTIAL_ARTS.length)]);
    app.globalData.homePageMaskedCourses = newMasked;
    app.notifyCallbacks?.('onCoverRefresh', { coverLoadTime: t });

    this.setData({ refreshing: true, bannerTime: t, coverTime: t, maskedCourses: newMasked, headlines: [], courses: [] });

    Promise.all([this.loadHeadlines(), this.loadCourses()]).then(() => {
      this.setData({ refreshing: false });
    });
  },

  loadHeadlines() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'index' }
    }).then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({ ...h, image: this.processUrl(h.image, null, 'banner') }));
        app.globalData.indexHeadlines = headlines;
        wx.setStorageSync('indexHeadlines', headlines);
        this.setData({
          headlines,
          bannerSpeed: (res.result.speed || 5) * 1000,
          homeProtect: res.result.homeProtect !== false
        });
        this.maskCourses();
      }
    }).catch(e => console.error('获取头条失败', e));
  },

  loadCourses() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCourses', limit: 20, filterDraft: true, userId: app.globalData.userId }
    }).then(res => {
      if (res.result.success) {
        const courses = res.result.data.map(c => ({ ...c, cover: this.processUrl(c.cover, null, 'cover') }));
        app.globalData.indexCourses = courses;
        wx.setStorageSync('indexCourses', courses);
        this.setData({ courses, loading: false });
        this.maskCourses();
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => this.setData({ loading: false }));
  },

  maskCourses() {
    const { homeProtect, isLoggedIn, courses, maskedCourses } = this.data;
    if (!homeProtect || isLoggedIn) {
      // 已登录或首页保护关闭，恢复真实课程数据
      const realCourses = app.globalData.indexCourses || wx.getStorageSync('indexCourses') || [];
      if (realCourses.length > 0) {
        this.setData({ courses: realCourses });
      }
      return;
    }

    const newMasked = { ...maskedCourses };
    const masked = courses.map(c => {
      let cached = newMasked[c._id];
      if (!cached) {
        const art = MARTIAL_ARTS[Math.floor(Math.random() * MARTIAL_ARTS.length)];
        const user = art.users[Math.floor(Math.random() * art.users.length)];
        cached = { art, user };
        newMasked[c._id] = cached;
      }
      return { ...c, title: cached.art.name, author: cached.user, categoryName: cached.art.type };
    });

    app.globalData.homePageMaskedCourses = newMasked;
    this.setData({ courses: masked, maskedCourses: newMasked });
  },

  checkLogin() {
    this.setData({ isLoggedIn: app.globalData.isLoggedIn || false });
    this.maskCourses();
  },

  handleLogin() {
    if (this.data.isLoggedIn) {
      // 已登录，显示退出确认弹窗
      this.setData({ logoutConfirmVisible: true });
    } else {
      // 未登录，跳转到登录页
      wx.navigateTo({ url: '/pages/login/index' });
    }
  },

  // 取消退出登录
  onLogoutCancel() {
    this.setData({ logoutConfirmVisible: false });
  },

  // 确认退出登录
  onLogoutConfirm() {
    this.setData({ logoutConfirmVisible: false });

    // 停止播放器并清空播放状态
    app.bgAudioManager.stop();
    app.globalData.miniPlayerActive = false;
    app.globalData.miniPlayerIndexFadedIn = false;
    app.globalData.playingCourse = null;
    app.globalData.playingChapter = null;
    app.globalData.playingSeq = null;
    app.globalData.playingIndex = 0;
    app.globalData.playlistChaptersData = [];
    app.globalData.favoriteChapters = [];
    app.globalData.playMode = 'sequence';
    app.globalData.playlistSortOrder = 'asc';
    app.notifyCallbacks?.('onClose', {});

    // 清除登录状态
    app.globalData.isLoggedIn = false;
    app.globalData.userInfo = null;
    app.globalData.userId = null;
    wx.removeStorageSync('userId');
    wx.removeStorageSync('userInfo');

    // 刷新当前页面状态
    this.setData({ isLoggedIn: false });
    this.maskCourses();

    // 显示退出提示（不设置 logoutFlag，避免切回首页时重复显示）
    setTimeout(() => wx.showToast({ title: '已退出登录', icon: 'success' }), 300);
  },

  onCourseTap(e) {
    if (!app.globalData.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    wx.navigateTo({ url: `/pages/chapter/index?id=${e.currentTarget.dataset.id}` });
  },

  onTabChange(e) {
    const idx = e.currentTarget.dataset.index;
    if (idx == 0) return;
    if (!app.globalData.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    const targetUrl = `/pages/${['', 'favorite', 'mine'][idx]}/index`;
    const pages = getCurrentPages();
    const targetPage = pages.find(p => p.route === `pages/${['', 'favorite', 'mine'][idx]}/index`);
    if (targetPage) {
      const delta = pages.length - pages.indexOf(targetPage) - 1;
      if (delta > 0) {
        wx.navigateBack({ delta });
      } else {
        wx.navigateTo({ url: targetUrl });
      }
    } else {
      wx.navigateTo({ url: targetUrl });
    }
  }
});