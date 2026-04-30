// index.js
const app = getApp();

const MARTIAL_ARTS = [
  { name: "黯然销魂掌", type: "掌法", users: ["杨过"] },
  { name: "天山六阳掌", type: "掌法", users: ["天山童姥","虚竹"] },
  { name: "白虹掌力", type: "掌法", users: ["李秋水"] },
  { name: "铁掌", type: "掌法", users: ["裘千仞"] },
  { name: "玄冥神掌", type: "掌法", users: ["百损道人","鹤笔翁","鹿杖客"] },
  { name: "落英神剑掌", type: "掌法", users: ["黄药师","黄蓉"] },
  { name: "寒冰绵掌", type: "掌法", users: ["韦一笑"] },
  { name: "绵掌", type: "掌法", users: ["张三丰","宋远桥","俞莲舟","俞岱岩"] },
  { name: "大力金刚掌", type: "掌法", users: ["玄慈","空闻","空智"] },
  { name: "须弥山掌", type: "掌法", users: ["玄慈"] },
  { name: "般若掌", type: "掌法", users: ["玄慈","空性","玄难"] },
  { name: "韦陀掌", type: "掌法", users: ["虚竹"] },
  { name: "混元掌", type: "掌法", users: ["穆人清","归辛树","袁承志"] },
  { name: "破玉掌", type: "掌法", users: ["穆人清","归辛树","袁承志"] },
  { name: "摧心掌", type: "掌法", users: ["陈玄风","梅超风"] },
  { name: "黑沙掌", type: "掌法", users: ["常赫志","常伯志","沙通天"] },
  { name: "五罗轻烟掌", type: "掌法", users: ["段正淳","秦红棉"] },
  { name: "碧波掌法", type: "掌法", users: ["黄药师","傻姑"] },
  { name: "神驼雪山掌", type: "掌法", users: ["欧阳克"] },
  { name: "金蛇游身掌", type: "掌法", users: ["夏雪宜","袁承志"] },
  { name: "八卦游龙掌", type: "掌法", users: ["张三丰"] },
  { name: "截手九式", type: "掌法", users: ["灭绝师太"] },
  { name: "飘雪穿云掌", type: "掌法", users: ["灭绝师太"] },
  { name: "四象掌", type: "掌法", users: ["灭绝师太","静玄"] },
  { name: "金顶绵掌", type: "掌法", users: ["灭绝师太","周芷若"] },
  { name: "大摔碑手", type: "掌法", users: ["陆菲青"] },
  { name: "大风云飞掌", type: "掌法", users: ["彭莹玉"] },
  { name: "化骨绵掌", type: "掌法", users: ["毛东珠","海大富"] },
  { name: "赤练神掌", type: "掌法", users: ["李莫愁"] },
  { name: "抽髓掌", type: "掌法", users: ["丁春秋"] },
  { name: "千蛛万毒手", type: "掌法", users: ["殷离"] },
  { name: "五行六合掌", type: "掌法", users: ["张无忌"] },
  { name: "大手印", type: "掌法", users: ["灵智上人"] },
  { name: "霹雳掌", type: "掌法", users: ["文泰来"] },
  { name: "冰蚕毒掌", type: "掌法", users: ["游坦之"] },
  { name: "一拍两散", type: "掌法", users: ["玄寂"] },
  { name: "太极拳", type: "拳法", users: ["张三丰","张无忌","俞岱岩"] },
  { name: "七伤拳", type: "拳法", users: ["谢逊","张无忌","崆峒五老"] },
  { name: "空明拳", type: "拳法", users: ["周伯通","郭靖"] },
  { name: "百花错拳", type: "拳法", users: ["袁士霄","陈家洛"] },
  { name: "灵蛇拳", type: "拳法", users: ["欧阳锋","欧阳克"] },
  { name: "太祖长拳", type: "拳法", users: ["乔峰"] },
  { name: "罗汉拳", type: "拳法", users: ["虚竹"] },
  { name: "少林长拳", type: "拳法", users: ["虚竹"] },
  { name: "大金刚拳", type: "拳法", users: ["玄慈","鸠摩智"] },
  { name: "美女拳法", type: "拳法", users: ["林朝英","小龙女","杨过"] },
  { name: "破玉拳", type: "拳法", users: ["袁承志","归辛树"] },
  { name: "逍遥游拳法", type: "拳法", users: ["洪七公","黄蓉"] },
  { name: "野狐拳法", type: "拳法", users: ["梁子翁"] },
  { name: "八卦掌", type: "拳法", users: ["王维扬"] },
  { name: "无极玄功拳", type: "拳法", users: ["陆菲青"] },
  { name: "武当长拳", type: "拳法", users: ["张无忌"] },
  { name: "回风拂柳拳", type: "拳法", users: ["郑长老"] },
  { name: "旋风扫叶腿", type: "腿法", users: ["黄药师"] },
  { name: "如影随形腿", type: "腿法", users: ["鸠摩智"] },
  { name: "旋风腿", type: "腿法", users: ["刘处玄"] },
  { name: "一阳指", type: "指法", users: ["一灯大师"] },
  { name: "弹指神通", type: "指法", users: ["黄药师"] },
  { name: "拈花指", type: "指法", users: ["鸠摩智"] },
  { name: "无相劫指", type: "指法", users: ["鸠摩智"] },
  { name: "大力金刚指", type: "指法", users: ["火工头陀","阿三"] },
  { name: "幻阴指", type: "指法", users: ["成昆"] },
  { name: "多罗叶指", type: "指法", users: ["鸠摩智"] },
  { name: "摩诃指", type: "指法", users: ["鸠摩智"] },
  { name: "大智无定指", type: "指法", users: ["鸠摩智"] },
  { name: "一指禅", type: "指法", users: ["澄观"] },
  { name: "玄天指", type: "指法", users: ["黑白子"] },
  { name: "寒冰指", type: "指法", users: ["鹤笔翁","鹿杖客"] },
  { name: "自在指", type: "指法", users: ["鸠摩智"] },
  { name: "六丁开山", type: "指法", users: ["虚竹"] },
  { name: "虎爪绝户手", type: "指法", users: ["俞莲舟"] },
  { name: "参合指", type: "指法", users: ["慕容博"] },
  { name: "九阴白骨爪", type: "爪法", users: ["陈玄风","梅超风","周芷若"] },
  { name: "龙爪手", type: "爪法", users: ["空性","张无忌"] },
  { name: "鹰爪功", type: "爪法", users: ["殷天正"] },
  { name: "凝血神爪", type: "爪法", users: ["陈近南"] },
  { name: "鹰爪擒拿手", type: "爪法", users: ["殷天正"] },
  { name: "三阴蜈蚣爪", type: "爪法", users: ["李莫愁"] },
  { name: "天山折梅手", type: "擒拿", users: ["天山童姥","虚竹"] },
  { name: "分筋错骨手", type: "擒拿", users: ["朱聪","陈家洛","鸠摩智"] },
  { name: "沾衣十八跌", type: "擒拿", users: ["陆菲青"] },
  { name: "缠丝擒拿手", type: "擒拿", users: ["白世镜"] },
  { name: "关外大力擒拿手", type: "擒拿", users: ["梁子翁"] },
  { name: "锁喉擒拿手", type: "擒拿", users: ["马大元"] },
  { name: "兰花拂穴手", type: "点穴", users: ["黄药师","黄蓉"] },
  { name: "一阳书指", type: "点穴", users: ["朱子柳"] },
  { name: "拂穴手", type: "点穴", users: ["朱聪"] },
  { name: "铁指诀", type: "点穴", users: ["陆菲青"] },
  { name: "九阴真经", type: "内功", users: ["黄裳","郭靖","周伯通"] },
  { name: "九阳神功", type: "内功", users: ["觉远","张无忌"] },
  { name: "易筋经", type: "内功", users: ["达摩","游坦之","令狐冲","方证"] },
  { name: "北冥神功", type: "内功", users: ["无崖子","段誉","虚竹"] },
  { name: "小无相功", type: "内功", users: ["无崖子","李秋水","鸠摩智","虚竹"] },
  { name: "八荒六合唯我独尊功", type: "内功", users: ["天山童姥"] },
  { name: "先天功", type: "内功", users: ["王重阳","一灯大师"] },
  { name: "蛤蟆功", type: "内功", users: ["欧阳锋"] },
  { name: "龙象般若功", type: "内功", users: ["金轮法王"] },
  { name: "神照经", type: "内功", users: ["丁典","狄云"] },
  { name: "葵花宝典", type: "内功", users: ["东方不败"] },
  { name: "太玄经", type: "内功", users: ["石破天"] },
  { name: "纯阳无极功", type: "内功", users: ["张三丰"] },
  { name: "紫霞神功", type: "内功", users: ["岳不群"] },
  { name: "吸星大法", type: "内功", users: ["任我行","令狐冲"] },
  { name: "化功大法", type: "内功", users: ["丁春秋"] },
  { name: "乾坤大挪移", type: "内功", users: ["张无忌","阳顶天"] },
  { name: "斗转星移", type: "内功", users: ["慕容博","慕容复"] },
  { name: "枯荣禅功", type: "内功", users: ["枯荣大师"] },
  { name: "混元功", type: "内功", users: ["穆人清","归辛树","袁承志"] },
  { name: "金刚不坏体", type: "内功", users: ["空见"] },
  { name: "罗汉伏魔神功", type: "内功", users: ["石破天"] },
  { name: "峨嵋九阳功", type: "内功", users: ["郭襄","灭绝师太"] },
  { name: "圣火令武功", type: "内功", users: ["张无忌","风云月三使"] },
  { name: "释迦掷象功", type: "内功", users: ["尼摩星"] },
  { name: "闭穴功", type: "内功", users: ["公孙止"] },
  { name: "擒龙功", type: "内功", users: ["乔峰"] },
  { name: "狮子吼", type: "内功", users: ["谢逊","方证"] },
  { name: "玉女心经", type: "内功", users: ["林朝英","小龙女","杨过"] },
  { name: "寒冰真气", type: "内功", users: ["左冷禅"] },
  { name: "六脉神剑", type: "剑法", users: ["段誉","枯荣大师"] },
  { name: "独孤九剑", type: "剑法", users: ["独孤求败","风清扬","令狐冲"] },
  { name: "太极剑法", type: "剑法", users: ["张三丰","张无忌","冲虚道长"] },
  { name: "辟邪剑法", type: "剑法", users: ["林远图","岳不群","林平之"] },
  { name: "玉女素心剑法", type: "剑法", users: ["林朝英","小龙女","杨过"] },
  { name: "全真剑法", type: "剑法", users: ["王重阳","全真七子","杨过"] },
  { name: "玄铁剑法", type: "剑法", users: ["杨过"] },
  { name: "苗家剑法", type: "剑法", users: ["苗人凤"] },
  { name: "金蛇剑法", type: "剑法", users: ["夏雪宜","袁承志"] },
  { name: "连城剑法", type: "剑法", users: ["梅念笙","狄云"] },
  { name: "雪山剑法", type: "剑法", users: ["白自在","白万剑"] },
  { name: "追魂夺命剑", type: "剑法", users: ["无尘道人"] },
  { name: "柔云剑法", type: "剑法", users: ["陆菲青"] },
  { name: "绕指柔剑", type: "剑法", users: ["张三丰","莫声谷"] },
  { name: "神门十三剑", type: "剑法", users: ["张三丰","莫声谷"] },
  { name: "两仪剑法", type: "剑法", users: ["何太冲","班淑娴"] },
  { name: "华山剑法", type: "剑法", users: ["岳不群","令狐冲"] },
  { name: "冲灵剑法", type: "剑法", users: ["令狐冲","岳灵珊"] },
  { name: "玉箫剑法", type: "剑法", users: ["黄药师"] },
  { name: "哀牢山三十六剑", type: "剑法", users: ["朱子柳"] },
  { name: "松风剑法", type: "剑法", users: ["余沧海"] },
  { name: "狂风快剑", type: "剑法", users: ["封不平"] },
  { name: "夺命连环三仙剑", type: "剑法", users: ["岳不群"] },
  { name: "泼墨披麻剑法", type: "剑法", users: ["丹青生"] },
  { name: "恒山剑法", type: "剑法", users: ["定逸师太","定静师太","定闲师太"] },
  { name: "万花剑法", type: "剑法", users: ["定静师太"] },
  { name: "淑女剑法", type: "剑法", users: ["宁中则"] },
  { name: "三分剑术", type: "剑法", users: ["霍青桐"] },
  { name: "泰山剑法", type: "剑法", users: ["天门道人"] },
  { name: "衡山剑法", type: "剑法", users: ["莫大","刘正风"] },
  { name: "嵩山剑法", type: "剑法", users: ["左冷禅"] },
  { name: "回风落雁剑法", type: "剑法", users: ["莫大"] },
  { name: "百变千幻衡山云雾十三式", type: "剑法", users: ["莫大"] },
  { name: "灭剑", type: "剑法", users: ["灭绝师太"] },
  { name: "绝剑", type: "剑法", users: ["灭绝师太"] },
  { name: "七弦无形剑", type: "剑法", users: ["黄钟公"] },
  { name: "胡家刀法", type: "刀法", users: ["胡一刀","胡斐"] },
  { name: "血刀刀法", type: "刀法", users: ["血刀老祖","狄云"] },
  { name: "燃木刀法", type: "刀法", users: ["玄苦"] },
  { name: "火焰刀", type: "刀法", users: ["鸠摩智"] },
  { name: "奇门三才刀", type: "刀法", users: ["吴长风"] },
  { name: "夫妻刀法", type: "刀法", users: ["林玉龙","任飞燕"] },
  { name: "南山刀法", type: "刀法", users: ["南希仁"] },
  { name: "金刚伏魔刀法", type: "刀法", users: ["陈家洛"] },
  { name: "八卦刀", type: "刀法", users: ["王维扬"] },
  { name: "百胜刀法", type: "刀法", users: ["黄真"] },
  { name: "罗汉刀法", type: "刀法", users: ["陆冠英"] },
  { name: "飞沙走石十三式", type: "刀法", users: ["田伯光"] },
  { name: "狂风刀法", type: "刀法", users: ["田伯光"] },
  { name: "修罗刀", type: "刀法", users: ["秦红棉"] },
  { name: "鱼鳞紫金刀", type: "刀法", users: ["胜三宫"] },
  { name: "玄虚刀法", type: "刀法", users: ["张三丰"] },
  { name: "金乌刀法", type: "刀法", users: ["史小翠","石破天"] },
  { name: "伏魔杖法", type: "杖法", users: ["柯镇恶","郭靖","萧远山"] },
  { name: "疯魔杖法", type: "杖法", users: ["简长老","蒋四根"] },
  { name: "大力金刚杖法", type: "杖法", users: ["简长老"] },
  { name: "西毒杖法", type: "杖法", users: ["欧阳锋"] },
  { name: "灵蛇杖法", type: "杖法", users: ["欧阳锋"] },
  { name: "大韦陀杵", type: "杖法", users: ["玄悲"] },
  { name: "打狗棒法", type: "棒法", users: ["洪七公","黄蓉"] },
  { name: "齐眉棍法", type: "棍法", users: ["成璜"] },
  { name: "白蟒鞭法", type: "鞭法", users: ["梅超风"] },
  { name: "黄沙万里鞭法", type: "鞭法", users: ["尹克西"] },
  { name: "呼延十八鞭", type: "鞭法", users: ["周威信","卓天雄"] },
  { name: "金龙鞭法", type: "鞭法", users: ["韩宝驹"] },
  { name: "回打软鞭十三式", type: "鞭法", users: ["陈孤雁"] },
  { name: "毒龙鞭法", type: "鞭法", users: ["何铁手"] },
  { name: "鳄尾鞭", type: "鞭法", users: ["岳老三"] },
  { name: "杨家枪法", type: "枪法", users: ["杨铁心","杨康"] },
  { name: "中平枪法", type: "枪法", users: ["花铁干"] },
  { name: "六合枪", type: "枪法", users: ["曾图南"] },
  { name: "凌波微步", type: "轻功", users: ["段誉"] },
  { name: "梯云纵", type: "轻功", users: ["张三丰","张无忌"] },
  { name: "神行百变", type: "轻功", users: ["木桑道长","九难","韦小宝","袁承志"] },
  { name: "金雁功", type: "轻功", users: ["马钰","丘处机","郭靖"] },
  { name: "飞天神行", type: "轻功", users: ["赵半山","胡斐"] },
  { name: "草上飞", type: "轻功", users: ["韦一笑"] },
  { name: "万里独行", type: "轻功", users: ["田伯光"] },
  { name: "移形换位", type: "轻功", users: ["慕容复","慕容博"] },
  { name: "登萍渡水", type: "轻功", users: ["周伯通","黄药师"] },
  { name: "生死符", type: "暗器", users: ["天山童姥","虚竹"] },
  { name: "冰魄银针", type: "暗器", users: ["李莫愁"] },
  { name: "玉蜂针", type: "暗器", users: ["小龙女","杨过"] },
  { name: "金蛇锥", type: "暗器", users: ["夏雪宜","袁承志"] },
  { name: "枣核钉", type: "暗器", users: ["裘千尺"] },
  { name: "含沙射影", type: "暗器", users: ["何铁手","韦小宝","袁承志"] },
  { name: "飞燕银梭", type: "暗器", users: ["赵半山"] },
  { name: "黑血神针", type: "暗器", users: ["曲洋"] },
  { name: "天罡北斗阵", type: "阵法", users: ["全真七子"] },
  { name: "真武七截阵", type: "阵法", users: ["张三丰","武当七侠"] },
  { name: "金刚伏魔圈", type: "阵法", users: ["渡厄","渡劫","渡难"] },
  { name: "五行阵", type: "阵法", users: ["温家五老"] },
  { name: "正反两仪阵", type: "阵法", users: ["何太冲","班淑娴","华山二老"] },
  { name: "渔网阵", type: "阵法", users: ["公孙止"] },
  { name: "二十八宿大阵", type: "阵法", users: ["郭靖","黄蓉","黄药师"] },
  { name: "阴阳倒乱刃法", type: "奇门", users: ["公孙止"] },
  { name: "蜀道难牌法", type: "奇门", users: ["九翼道人"] },
  { name: "盘根错节十八斧", type: "奇门", users: ["古笃诚"] },
  { name: "吴钩剑法", type: "奇门", users: ["贝人龙"] },
  { name: "渔叟钩法", type: "奇门", users: ["北渔拓跋氏"] },
  { name: "五轮大转", type: "奇门", users: ["金轮法王","达尔巴"] },
  { name: "鹤蛇八打", type: "奇门", users: ["云中鹤"] },
  { name: "鳄嘴剪法", type: "奇门", users: ["岳老三"] },
  { name: "奇门五转", type: "奇门", users: ["黄药师"] },
  { name: "圣火令武功", type: "奇门", users: ["张无忌","风云月三使"] },
  { name: "阴风刀", type: "奇门", users: ["风云月三使"] },
  { name: "左右互搏", type: "奇门", users: ["周伯通","郭靖","小龙女"] },
  { name: "释迦掷象功", type: "奇门", users: ["尼摩星"] },
  { name: "千变万劫", type: "奇门", users: ["木桑道长"] },
  { name: "棋盘功", type: "奇门", users: ["木桑道长"] },
  { name: "铁蒲扇手", type: "奇门", users: ["欧阳锋"] },
  { name: "碧海潮生曲", type: "奇门", users: ["黄药师"] },
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
      loading: true // 始终显示 loading，等数据加载完成后再决定显示什么
    });

    if (!headlines.length) this.loadHeadlines();
    else this.maskCourses();

    this.loadCourses(); // 始终重新加载课程数据，加载完成后再根据登录状态决定显示
  },

  onShow() {
    this.checkLogin();
    this.syncTimes();
    this.showStatusToast();
    // 重新检查登录状态，确保显示正确的课程数据
    if (app.globalData.isLoggedIn !== this.data.isLoggedIn) {
      this.checkLogin();
    }
    // 如果有真实课程数据，重新执行 maskCourses 以更新显示
    if (this._realCourses && this._realCourses.length) {
      this.maskCourses();
    }
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
        // 先不设置 courses，等 maskCourses 处理后再设置
        this.maskCourses(courses);
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => this.setData({ loading: false }));
  },

  maskCourses(realCourses) {
    // 如果传入了 realCourses，先保存到 this._realCourses
    if (realCourses) {
      this._realCourses = realCourses;
    }

    const { homeProtect, isLoggedIn } = this.data;
    // 使用保存的真实课程数据
    const courses = this._realCourses || [];

    if (!homeProtect || isLoggedIn) {
      // 已登录或首页保护关闭，恢复真实课程数据
      this.setData({ courses, loading: false });
      return;
    }

    // 未登录，显示脱敏数据
    let maskedCourses = this.data.maskedCourses || {};
    const masked = courses.map(c => {
      let cached = maskedCourses[c._id];
      if (!cached) {
        const art = MARTIAL_ARTS[Math.floor(Math.random() * MARTIAL_ARTS.length)];
        const user = art.users[Math.floor(Math.random() * art.users.length)];
        // 保存完整课程数据，只是 title/author/categoryName 脱敏
        cached = { ...c, title: art.name, author: user, categoryName: art.type };
        maskedCourses[c._id] = cached;
      }
      return cached;
    });

    app.globalData.homePageMaskedCourses = maskedCourses;
    this.setData({ courses: masked, maskedCourses, loading: false });
  },

  checkLogin() {
    const prevState = this.data.isLoggedIn;
    const newState = app.globalData.isLoggedIn || false;
    if (prevState !== newState) {
      this.setData({ isLoggedIn: newState });
      if (newState && this._realCourses && this._realCourses.length) {
        // 登录后直接恢复真实课程
        this.setData({ courses: this._realCourses, loading: false });
      }
    }
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
    app.resetPlayState();
    app.globalData.favoriteChapters = [];
    app.globalData.playlistSortOrder = 'asc';
    app.notifyCallbacks?.('onClose', {});

    // 清除登录状态
    app.globalData.isLoggedIn = false;
    app.globalData.userInfo = null;
    app.globalData.userId = null;
    wx.removeStorageSync('userId');
    wx.removeStorageSync('userInfo');

    // 清理课程缓存，防止退出后真实数据残留在本地
    app.globalData.indexCourses = [];
    wx.removeStorageSync('indexCourses');

    // 清理播放状态缓存，确保重新进入时不恢复 mini-player
    wx.removeStorageSync('playingCourse');
    wx.removeStorageSync('playingChapter');
    wx.removeStorageSync('playingSeq');
    wx.removeStorageSync('playlistSortOrder');
    wx.removeStorageSync('playMode');

    // 恢复脱敏数据（保留 this._realCourses 用于第二次登录恢复）
    const maskedCourses = app.globalData.homePageMaskedCourses || {};
    const courses = Object.values(maskedCourses);

    this.setData({ isLoggedIn: false, courses, maskedCourses, loading: false });
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