// index.js
const app = getApp();

// 随机作者名称列表（金庸小说人物，共200人，优先选择知名人物）
const randomAuthors = [
  // ===== 射雕英雄传（25人）=====
  '郭靖', '黄蓉', '黄药师', '欧阳锋', '洪七公', '周伯通', '一灯大师', '梅超风', '杨康', '穆念慈',
  '丘处机', '马钰', '柯镇恶', '华筝', '拖雷', '铁木真', '欧阳克', '完颜洪烈', '瑛姑', '裘千仞',
  '冯衡', '陆乘风', '程瑶迦', '陆冠英', '尹志平',

  // ===== 神雕侠侣（20人）=====
  '杨过', '小龙女', '郭襄', '李莫愁', '金轮法王', '公孙止', '裘千尺', '耶律齐', '霍都', '达尔巴',
  '陆无双', '程英', '公孙绿萼', '洪凌波', '郭芙', '武三通', '孙婆婆', '甄志丙', '赵志敬', '独孤求败',

  // ===== 倚天屠龙记（25人）=====
  '张无忌', '赵敏', '周芷若', '小昭', '殷离', '张三丰', '谢逊', '杨逍', '范遥', '殷天正',
  '韦一笑', '灭绝师太', '成昆', '宋青书', '纪晓芙', '殷素素', '张翠山', '宋远桥', '俞莲舟', '殷梨亭',
  '金花婆婆', '黛绮丝', '陈友谅', '朱元璋', '胡青牛',

  // ===== 天龙八部（25人）=====
  '乔峰', '段誉', '虚竹', '王语嫣', '阿朱', '阿紫', '慕容复', '鸠摩智', '段正淳', '扫地僧',
  '天山童姥', '李秋水', '无崖子', '丁春秋', '段延庆', '叶二娘', '岳老三', '云中鹤', '木婉清', '钟灵',
  '阿碧', '包不同', '风波恶', '萧远山', '慕容博',

  // ===== 笑傲江湖（20人）=====
  '令狐冲', '任盈盈', '岳不群', '宁中则', '林平之', '岳灵珊', '东方不败', '任我行', '向问天', '左冷禅',
  '风清扬', '方证大师', '冲虚道长', '莫大先生', '刘正风', '曲洋', '余沧海', '定闲师太', '蓝凤凰', '平一指',

  // ===== 鹿鼎记（20人）=====
  '韦小宝', '康熙', '双儿', '阿珂', '苏荃', '方怡', '沐剑屏', '曾柔', '建宁公主', '陈近南',
  '鳌拜', '索额图', '明珠', '施琅', '茅十八', '九难师太', '洪教主', '胖头陀', '瘦头陀', '吴三桂',

  // ===== 书剑恩仇录（15人）=====
  '陈家洛', '霍青桐', '香香公主', '文泰来', '骆冰', '无尘道长', '赵半山', '周绮', '章进', '余万亭',
  '天山双鹰', '袁士霄', '阿凡提', '张召重', '周仲英',

  // ===== 碧血剑（15人）=====
  '袁承志', '温青青', '金蛇郎君', '何红药', '温仪', '穆人清', '归辛树', '归二娘', '何铁手', '李自成',
  '焦宛儿', '安小慧', '黄真', '刘宗敏', '袁崇焕',

  // ===== 雪山飞狐（10人）=====
  '胡斐', '苗若兰', '苗人凤', '胡一刀', '南兰', '田归农', '宝树和尚', '平阿四', '凤天南', '陶百岁',

  // ===== 连城诀（8人）=====
  '狄云', '戚芳', '水笙', '丁典', '凌霜华', '万震山', '万圭', '血刀老祖',

  // ===== 侠客行（8人）=====
  '石破天', '石中玉', '白自在', '谢烟客', '贝海石', '丁不三', '丁不四', '阿绣',

  // ===== 其他小说（12人）=====
  '李文秀', '苏普', '阿青', '范蠡', '西施', '勾践', '袁冠男', '萧中慧', '卓天雄', '林玉龙', '任飞燕', '太岳四侠'
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