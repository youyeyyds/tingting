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
    bannerLoadTime: 0, // 横幅时间戳
    coverLoadTime: 0, // 封面时间戳（只有首页刷新才更新）
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

    // 使用全局变量，只在首次加载时生成时间戳和数据
    if (!app.globalData.bannerLoadTime) {
      app.globalData.bannerLoadTime = Date.now();
    }
    if (!app.globalData.coverLoadTime) {
      app.globalData.coverLoadTime = Date.now();
    }
    // 使用全局 maskedAuthors，保持作者稳定
    if (!app.globalData.homePageMaskedAuthors) {
      app.globalData.homePageMaskedAuthors = {};
    }
    const bannerLoadTime = app.globalData.bannerLoadTime;
    const coverLoadTime = app.globalData.coverLoadTime;
    const maskedAuthors = app.globalData.homePageMaskedAuthors;
    // 检查是否有缓存的数据
    const cachedHeadlines = app.globalData.indexHeadlines || [];
    const cachedCourses = app.globalData.indexCourses || [];

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: headerHeight,
      scrollHeight: scrollHeight,
      bannerLoadTime: bannerLoadTime,
      coverLoadTime: coverLoadTime,
      maskedAuthors: maskedAuthors,
      headlines: cachedHeadlines,
      courses: cachedCourses
    });

    this.checkLoginStatus();
    // 只在首次加载（无缓存）时获取数据
    if (cachedHeadlines.length === 0) {
      this.loadHeadlinesAsync();
    } else {
      // 有缓存时，直接处理课程显示
      this.processCourses();
    }
    if (cachedCourses.length === 0) {
      this.loadCoursesAsync();
    }
  },

  onShow() {
    this.checkLoginStatus();
    // 检查横幅时间戳是否变化，变化则更新横幅URL
    const globalBannerTime = app.globalData.bannerLoadTime;
    const globalCoverTime = app.globalData.coverLoadTime;

    if (globalBannerTime && globalBannerTime !== this.data.bannerLoadTime) {
      // 先更新时间戳，再处理横幅URL
      const headlines = this.data.headlines.map(h => {
        // 从URL中提取原始信息，直接用新时间戳重新构建URL
        const newUrl = this.rebuildImageUrl(h.image, globalBannerTime, 'banner');
        return { ...h, image: newUrl };
      });
      this.setData({
        bannerLoadTime: globalBannerTime,
        headlines: headlines
      });
    }

    if (globalCoverTime && globalCoverTime !== this.data.coverLoadTime) {
      // 先更新时间戳，再处理封面URL
      const courses = this.data.courses.map(c => {
        const newUrl = this.rebuildImageUrl(c.cover, globalCoverTime, 'cover');
        return { ...c, cover: newUrl };
      });
      this.setData({
        coverLoadTime: globalCoverTime,
        courses: courses
      });
      this.processCourses();
    }

    // 检查退出登录标志，显示提示
    if (app.globalData.logoutFlag) {
      app.globalData.logoutFlag = false;
      // 等首页渲染完成后再显示提示
      setTimeout(() => {
        wx.showToast({ title: '已退出登录', icon: 'success', duration: 2000 });
      }, 500);
    }
    // 切换页面时不重新加载，保持原有数据
  },

  // 从已处理的URL中提取信息，用新时间戳重新构建
  rebuildImageUrl(url, newLoadTime, type) {
    if (!url) return url;

    // 如果已经是时间戳格式的seed，提取原始信息替换时间戳
    if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_(banner|cover)_/)) {
      const seedMatch = url.match(/picsum\.photos\/seed\/\d+_(banner|cover)_([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        const originalSeed = seedMatch[2];
        const size = seedMatch[3];
        const newSeed = `${newLoadTime}_${type}_${originalSeed}`;
        return `https://picsum.photos/seed/${newSeed}/${size}`;
      }
    }

    // 如果不是已处理的URL，使用 fixImageUrl 处理
    return this.fixImageUrl(url, type);
  },

  onRefresh() {
    // 更新全局横幅时间戳和清除所有横幅缓存，刷新图片
    const newLoadTime = Date.now();
    app.globalData.bannerLoadTime = newLoadTime;
    app.globalData.coverLoadTime = newLoadTime; // 首页刷新才更新封面时间戳
    app.globalData.indexHeadlines = [];
    app.globalData.indexCourses = [];
    app.globalData.loginHeadlines = [];
    app.globalData.favoriteHeadlines = [];
    app.globalData.mineHeadlines = [];
    // 重新生成随机作者
    const newMaskedAuthors = {};
    this.data.courses.forEach(course => {
      newMaskedAuthors[course._id] = randomAuthors[Math.floor(Math.random() * randomAuthors.length)];
    });
    // 更新全局变量
    app.globalData.homePageMaskedAuthors = newMaskedAuthors;
    this.setData({ refresherTriggered: true, bannerLoadTime: newLoadTime, coverLoadTime: newLoadTime, maskedAuthors: newMaskedAuthors, headlines: [], courses: [] });
    Promise.all([
      this.loadHeadlinesAsync(),
      this.loadCoursesAsync()
    ]).then(() => {
      this.setData({ refresherTriggered: false });
    });
  },

  // 固定图片URL，使用picsum的seed格式保证稳定但刷新时变化
  // type: 'banner' 横幅图片, 'cover' 封面图片
  fixImageUrl(url, type = 'img') {
    if (!url) return url;
    // 横幅用 bannerLoadTime，封面用 coverLoadTime
    const loadTime = type === 'banner' ? this.data.bannerLoadTime : this.data.coverLoadTime;

    // 检查URL是否已经包含时间戳格式的seed（如 123456_banner_xxx 或 123456_cover_xxx），说明已处理过
    if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_(banner|cover)_/)) {
      // 已处理过，但时间戳可能变化，需要替换新的时间戳
      const seedMatch = url.match(/picsum\.photos\/seed\/(\d+)_(banner|cover)_([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        const oldTime = seedMatch[1];
        const urlType = seedMatch[2];
        const originalSeed = seedMatch[3];
        const size = seedMatch[4];
        // 只有类型匹配且时间戳变化时才替换
        if (urlType === type && oldTime != loadTime) {
          const newSeed = `${loadTime}_${type}_${originalSeed}`;
          return `https://picsum.photos/seed/${newSeed}/${size}`;
        }
        return url; // 时间戳相同或类型不匹配，直接返回
      }
    }

    // 处理 picsum.photos URL
    if (url.includes('picsum.photos')) {
      // 如果已经是seed格式（非时间戳格式），替换seed为时间戳+类型+原seed组合
      // 格式: https://picsum.photos/seed/course1/400/400
      const seedMatch = url.match(/picsum\.photos\/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        const originalSeed = seedMatch[1]; // 如 "course1"
        const size = seedMatch[2]; // 如 "400/400" 或 "400"
        const newSeed = `${loadTime}_${type}_${originalSeed}`;
        return `https://picsum.photos/seed/${newSeed}/${size}`;
      }

      // 提取尺寸信息，支持两种格式：
      // 格式1: https://picsum.photos/800/300?random=1
      // 格式2: https://picsum.photos/400?random=1
      const sizeMatch = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
      const randomMatch = url.match(/random=(\d+)/);

      if (sizeMatch) {
        const size = sizeMatch[1]; // 如 "800/300" 或 "400"
        const originalRandom = randomMatch ? randomMatch[1] : '0';
        // 组合时间戳+类型+原始random作为种子
        const seed = `${loadTime}_${type}_${originalRandom}`;
        return `https://picsum.photos/seed/${seed}/${size}`;
      }
    }

    // 其他URL添加时间戳防缓存
    return this.addTimestamp(url, type);
  },

  // 添加时间戳到URL
  addTimestamp(url, type = 'img') {
    if (!url) return url;
    const loadTime = type === 'banner' ? this.data.bannerLoadTime : this.data.coverLoadTime;
    return url.includes('?') ? `${url}&t=${loadTime}` : `${url}?t=${loadTime}`;
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
          image: this.fixImageUrl(h.image, 'banner')
        }));
        // 缓存到全局变量
        app.globalData.indexHeadlines = headlines;
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
          cover: this.fixImageUrl(c.cover, 'cover')
        }));
        // 缓存到全局变量
        app.globalData.indexCourses = courses;
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