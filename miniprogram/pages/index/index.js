// index.js
const app = getApp();

// 随机作者名称列表（金庸小说人物，共500个，按小说知名度排序）
const randomAuthors = [
  // ===== 射雕英雄传（50人）=====
  '郭靖', '黄蓉', '黄药师', '欧阳锋', '洪七公', '周伯通', '一灯大师', '梅超风', '杨康', '穆念慈',
  '柯镇恶', '朱聪', '韩宝驹', '韩小莹', '丘处机', '马钰', '瑛姑', '欧阳克', '完颜洪烈', '鲁有脚',
  '全金发', '张阿生', '南希仁', '华筝', '拖雷', '哲别', '铁木真', '窝阔台', '察合台', '术赤',
  '王处一', '郝大通', '孙不二', '刘处玄', '谭处端', '崔志方', '尹志平', '陆乘风', '程瑶迦', '陆冠英',
  '简长老', '彭长老', '净慧', '慧定', '天龙寺僧', '渔樵耕读', '慈恩', '裘千丈', '裘千仞', '冯衡',

  // ===== 神雕侠侣（50人）=====
  '杨过', '小龙女', '郭襄', '李莫愁', '陆无双', '程英', '公孙止', '裘千尺', '耶律齐', '金轮法王',
  '霍都', '达尔巴', '赵志敬', '甄志丙', '孙婆婆', '独孤求败', '洪凌波', '武修文', '武敦儒', '完颜萍',
  '郭芙', '武三通', '武敦儒', '武修文', '樊一翁', '公孙绿萼', '柔儿', '黄蓉', '郭靖', '柯镇恶',
  '朱子柳', '点苍渔隐', '天竺僧人', '金轮国师', '潇湘子', '尼摩星', '尹克西', '马光佐', '史叔刚', '史伯威',
  '史仲猛', '史季强', '西山一窟鬼', '樊一翁', '神雕', '丑雕', '大头鬼', '长须鬼', '无常鬼', '笑脸鬼',

  // ===== 倚天屠龙记（50人）=====
  '张无忌', '赵敏', '周芷若', '小昭', '殷离', '谢逊', '张三丰', '宋远桥', '俞莲舟', '俞岱岩',
  '张翠山', '殷梨亭', '莫声谷', '成昆', '杨逍', '范遥', '殷天正', '韦一笑', '灭绝师太', '纪晓芙',
  '宋青书', '陈友谅', '朱元璋', '徐达', '常遇春', '胡青牛', '王难姑', '张松溪', '殷素素', '金花婆婆',
  '黛绮丝', '韩千叶', '范瑶', '苦头陀', '说不得', '彭莹玉', '周颠', '冷谦', '铁冠道人', '丁敏君',
  '静玄', '静虚', '静空', '静照', '贝锦仪', '何太冲', '班淑娴', '高老者', '矮老者', '鲜于通',

  // ===== 天龙八部（50人）=====
  '乔峰', '段誉', '虚竹', '王语嫣', '阿朱', '阿紫', '慕容复', '游坦之', '鸠摩智', '段正淳',
  '天山童姥', '李秋水', '无崖子', '丁春秋', '苏星河', '段延庆', '叶二娘', '岳老三', '云中鹤', '木婉清',
  '刀白凤', '甘宝宝', '秦红棉', '阮星竹', '李青萝', '康敏', '钟灵', '阿碧', '阿朱', '包不同',
  '风波恶', '邓百川', '公冶乾', '萧远山', '慕容博', '玄慈', '玄难', '玄寂', '玄苦', '玄痛',
  '扫地僧', '神山上人', '哲罗星', '波罗星', '段智兴', '高升泰', '巴天石', '华赫艮', '范禹', '朱丹臣',

  // ===== 笑傲江湖（50人）=====
  '令狐冲', '任盈盈', '岳不群', '宁中则', '林平之', '岳灵珊', '左冷禅', '向问天', '任我行', '东方不败',
  '童柏熊', '黄钟公', '黑白子', '秃笔翁', '丹青生', '莫大先生', '刘正风', '曲洋', '定闲师太', '余沧海',
  '风清扬', '方证大师', '冲虚道长', '方生大师', '木高峰', '陆柏', '丁勉', '费彬', '钟镇', '成不忧',
  '封不平', '丛不弃', '易国梓', '史登达', '蓝凤凰', '秦伟邦', '桑三娘', '鲍大楚', '祖千秋', '老头子',
  '计无施', '天松道人', '天柏道人', '迟琳', '平一指', '祖千秋', '游迅', '谭迪人', '不戒和尚', '哑婆婆',

  // ===== 鹿鼎记（50人）=====
  '韦小宝', '陈近南', '康熙', '双儿', '阿珂', '苏荃', '方怡', '沐剑屏', '曾柔', '建宁公主',
  '鳌拜', '索额图', '明珠', '施琅', '风际中', '徐天川', '澄观', '澄光', '白寒松', '白寒生',
  '茅十八', '洪教主', '洪安通', '苏荃', '胖头陀', '瘦头陀', '陆高轩', '张淡月', '无根道人', '赤龙道人',
  '白龙使', '黑龙使', '青龙使', '黄龙使', '金顶道人', '柳燕', '菊潭', '桃蕊', '兰香', '竹心',
  '九难师太', '独臂神尼', '何铁手', '李自成', '吴三桂', '吴应熊', '夏国相', '马宝', '王国栋', '杨溢之',

  // ===== 书剑恩仇录（40人）=====
  '陈家洛', '霍青桐', '香香公主', '文泰来', '骆冰', '余万亭', '无尘道长', '赵半山', '徐天川', '心砚',
  '周绮', '孟健雄', '章进', '卫春华', '石双英', '蒋四根', '杨成协', '常赫志', '常伯志', '哈合台',
  '天山双鹰', '关明梅', '陈正德', '天镜', '袁士霄', '阿凡提', '腾里木', '铁板道人', '八臂神剑', '童兆和',
  '周仲英', '周英杰', '孟玉英', '安健刚', '阎世章', '阎世魁', '褚圆', '李可秀', '兆惠', '张召重',

  // ===== 碧血剑（40人）=====
  '袁承志', '温青青', '金蛇郎君', '何红药', '温仪', '温方山', '温方施', '温方悟', '温方禄', '穆人清',
  '黄真', '归辛树', '归二娘', '何铁手', '五毒教主', '李自成', '刘宗敏', '宋献策', '田见秀', '袁崇焕',
  '焦宛儿', '焦公礼', '闵子华', '郑云起', '梅剑和', '孙仲君', '刘培生', '崔希敏', '安小慧', '沙天广',
  '程青竹', '胡桂南', '铁罗汉', '七修剑', '水鉴', '安大娘', '孟伯飞', '孟铮', '飞天魔女', '孙传庭',

  // ===== 雪山飞狐（40人）=====
  '胡斐', '苗若兰', '苗人凤', '胡一刀', '南兰', '田归农', '商宝震', '阎基', '杜希孟', '平阿四',
  '宝树和尚', '陶百岁', '殷吉', '刘元鹤', '曹云奇', '周云阳', '阮士中', '姬晓峰', '欧阳公政', '上官铁生',
  '赛总管', '玄真道人', '无青子', '智通大师', '醉不死', '倪不通', '赵半山', '欧阳公政', '司马林', '褚万红',
  '蓝秦', '慕容景岳', '平阿四', '李长寿', '任通武', '秦耐之', '范帮主', '赛尚阿', '凤天南', '凤一鸣',

  // ===== 连城诀（35人）=====
  '狄云', '戚芳', '水笙', '丁典', '凌霜华', '万震山', '万圭', '言达平', '戚长发', '花铁干',
  '凌退思', '汪啸风', '桃红', '吴坎', '鲁东', '卜垣', '沈城', '万震山', '万圭', '言达平',
  '血刀老祖', '宝象', '善勇', '胜谛', '水岱', '陆高翔', '刘乘风', '汪啸风', '周圻', '耿光璧',
  '门人弟子', '牢头', '狱卒', '县太爷', '凌霜华母',

  // ===== 侠客行（35人）=====
  '石破天', '叮叮当当', '石中玉', '白自在', '史小翠', '谢烟客', '贝海石', '白万剑', '花万紫', '侍剑',
  '阿绣', '丁不三', '丁不四', '梅文馨', '欢喜老祖', '上清观主', '愚茶道长', '桂香婆婆', '冲虚道长', '清虚道长',
  '封万里', '廖自砺', '柯万钧', '冯万壁', '呼延万', '呼延生', '花万紫', '紫烟', '翠翠', '白万剑',
  '成自学', '齐自勉', '司马林', '聂老太太', '雪山派众',

  // ===== 白马啸西风（20人）=====
  '李文秀', '苏普', '阿曼', '瓦耳拉齐', '计老人', '马家骏', '陈达海', '霍元龙', '史仲俊', '叶尔逊',
  '宋遮天', '玄真道人', '吴伏波', '景风', '陈沅芷', '阿丽雅', '阿曼父', '苏普父', '车尔库', '哈萨克酋长',

  // ===== 鸳鸯刀（20人）=====
  '袁冠男', '萧中慧', '林玉龙', '任飞燕', '卓天雄', '太岳四侠', '逍遥子', '常长风', '盖一鸣', '祝小三',
  '周威信', '杨副总镖头', '张镖头', '王镖头', '李镖头', '赵镖头', '孙镖头', '铁二娘子', '铁老三', '铁老四',

  // ===== 越女剑（20人）=====
  '阿青', '范蠡', '西施', '勾践', '文种', '夫差', '白猿', '八剑士', '薛烛', '欧治子',
  '风胡子', '干将', '莫邪', '公孙无知', '伍子胥', '伯嚭', '王孙雄', '公孙余', '太子友', '越王勾践'
];

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0,
    scrollHeight: 0, // scroll-view 高度
    isLoggedIn: false,
    courses: [],
    headlines: [],
    bannerSpeed: 5000,
    homeProtect: true, // 默认开启首页保护
    loading: true,
    activeTab: 0,
    refresherTriggered: false,
    maskedAuthors: {}, // 存储课程ID对应的随机作者
    loadTime: '' // 加载时间戳
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;
    const headerHeight = windowInfo.statusBarHeight + navBarHeight;
    // scroll-view 高度 = 屏幕高度 - header - tabBar(100rpx转px)
    const rpxToPx = windowInfo.windowWidth / 750;
    const tabBarHeight = 100 * rpxToPx;
    const scrollHeight = windowInfo.windowHeight - headerHeight - tabBarHeight;

    // 使用全局 loadTime 和 maskedAuthors，保持图片稳定
    if (!app.globalData.homePageLoadTime) {
      app.globalData.homePageLoadTime = Date.now();
    }
    if (!app.globalData.homePageMaskedAuthors) {
      app.globalData.homePageMaskedAuthors = {};
    }
    const loadTime = app.globalData.homePageLoadTime;
    const maskedAuthors = app.globalData.homePageMaskedAuthors;

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: headerHeight,
      scrollHeight: scrollHeight,
      loadTime: loadTime,
      maskedAuthors: maskedAuthors
    });

    this.checkLoginStatus();
    this.loadHeadlinesAsync();
    this.loadCoursesAsync();
  },

  onShow() {
    this.checkLoginStatus();
    // 检查退出登录标志，显示提示
    if (app.globalData.logoutFlag) {
      app.globalData.logoutFlag = false;
      // 等首页渲染完成后再显示提示
      setTimeout(() => {
        wx.showToast({ title: '已退出登录', icon: 'none', duration: 2000 });
      }, 500);
    }
    // 切换页面时不重新加载，保持原有数据
  },

  onRefresh() {
    const newLoadTime = Date.now();
    // 重新生成随机作者
    const newMaskedAuthors = {};
    this.data.courses.forEach(course => {
      newMaskedAuthors[course._id] = randomAuthors[Math.floor(Math.random() * randomAuthors.length)];
    });
    // 更新全局变量
    app.globalData.homePageLoadTime = newLoadTime;
    app.globalData.homePageMaskedAuthors = newMaskedAuthors;
    this.setData({ refresherTriggered: true, loadTime: newLoadTime, maskedAuthors: newMaskedAuthors });
    Promise.all([
      this.loadHeadlinesAsync(),
      this.loadCoursesAsync()
    ]).then(() => {
      this.setData({ refresherTriggered: false });
    });
  },

  loadHeadlinesAsync() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'index' }
    })
    .then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({
          ...h,
          image: this.addTimestamp(h.image)
        }));
        this.setData({
          headlines: headlines,
          bannerSpeed: (res.result.speed || 5) * 1000,
          homeProtect: res.result.homeProtect !== false
        });
        this.processCourses();
      }
    })
    .catch(err => console.error('获取头条失败', err));
  },

  loadCoursesAsync() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'getCourses',
        limit: 20,
        filterDraft: true,
        userId: app.globalData.userId
      }
    })
    .then(res => {
      if (res.result.success) {
        const courses = res.result.data.map(c => ({
          ...c,
          cover: this.addTimestamp(c.cover)
        }));
        this.setData({
          courses: courses,
          loading: false
        });
        this.processCourses();
      } else {
        this.setData({ loading: false });
      }
    })
    .catch(err => {
      this.setData({ loading: false });
    });
  },

  addTimestamp(url) {
    if (!url) return url;
    const t = this.data.loadTime;
    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
  },

  // 处理课程显示（根据首页保护和登录状态）
  processCourses() {
    const { homeProtect, isLoggedIn, courses, maskedAuthors } = this.data;
    if (!homeProtect || isLoggedIn) {
      // 首页保护关闭或已登录，显示真实数据
      return;
    }
    // 首页保护开启且未登录，隐藏课程信息
    const newMaskedAuthors = { ...maskedAuthors };
    const maskedCourses = courses.map(course => {
      let randomAuthor = maskedAuthors[course._id];
      if (!randomAuthor) {
        randomAuthor = randomAuthors[Math.floor(Math.random() * randomAuthors.length)];
        newMaskedAuthors[course._id] = randomAuthor;
      }
      return {
        ...course,
        title: '登录后可见',
        author: randomAuthor
      };
    });
    // 更新全局和本地状态
    app.globalData.homePageMaskedAuthors = newMaskedAuthors;
    this.setData({ courses: maskedCourses, maskedAuthors: newMaskedAuthors });
  },

  checkLoginStatus() {
    this.setData({ isLoggedIn: app.globalData.isLoggedIn || false });
    this.processCourses();
  },

  handleLogin() {
    if (this.data.isLoggedIn) {
      // 已登录时跳转到个人页面
      wx.navigateTo({ url: '/pages/mine/index' });
    } else {
      // 未登录时跳转到登录页
      wx.navigateTo({ url: '/pages/login/index' });
    }
  },

  onCourseTap(e) {
    // 检查登录状态，未登录则跳转到登录页
    if (!app.globalData.isLoggedIn || !app.globalData.userId) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    wx.navigateTo({ url: `/pages/chapter/index?id=${e.currentTarget.dataset.id}` });
  },

  onHeadlineTap(e) {
    // 横幅点击不做任何操作
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    if (index == 0) return;
    // 未登录时，首页、收藏、我的都跳转登录页
    if (!app.globalData.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    wx.redirectTo({ url: `/pages/${['', 'favorite', 'mine'][index]}/index` });
  }
});