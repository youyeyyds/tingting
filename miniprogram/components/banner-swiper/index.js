// banner-swiper/index.js
Component({
  properties: {
    // 页面标识：'index', 'favorite', 'login', 'mine'
    page: {
      type: String,
      value: 'index'
    },
    // 外部传入的加载时间戳（用于图片缓存更新）
    loadTime: {
      type: Number,
      value: 0
    },
    // 扩展样式类名
    extClass: {
      type: String,
      value: ''
    }
  },

  data: {
    headlines: [],
    bannerSpeed: 5000
  },

  lifetimes: {
    attached() {
      this.loadHeadlines();
    }
  },

  methods: {
    // 加载头条数据
    loadHeadlines() {
      const page = this.data.page;
      wx.cloud.callFunction({
        name: 'courseFunctions',
        data: { type: 'getHeadlines', page: page }
      })
      .then(res => {
        if (res.result.success) {
          const headlines = res.result.data.map(h => ({
            ...h,
            image: this.fixImageUrl(h.image, 'banner')
          }));
          this.setData({
            headlines: headlines,
            bannerSpeed: (res.result.speed || 5) * 1000
          });
        }
      })
      .catch(err => console.error('获取头条失败', err));
    },

    // 刷新头条（供父页面调用）
    refresh(newLoadTime) {
      if (newLoadTime) {
        this.setData({ loadTime: newLoadTime });
      }
      this.loadHeadlines();
    },

    // 固定图片URL，使用picsum的seed格式保证稳定但刷新时变化
    // 横幅图片使用 loadTime（bannerLoadTime）
    fixImageUrl(url, type = 'banner') {
      if (!url) return url;
      const loadTime = this.data.loadTime || Date.now();

      // 检查是否包含 _fixed_ 标记，表示固定图片，不替换时间戳
      if (url.includes('picsum.photos/seed/') && url.includes('_fixed_')) {
        return url; // 固定图片，直接返回
      }

      // 处理 picsum.photos URL
      if (url.includes('picsum.photos')) {
        // 如果已经是seed格式，替换seed为时间戳+类型+原seed组合
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
      return this.addTimestamp(url);
    },

    // 添加时间戳到URL
    addTimestamp(url) {
      if (!url) return url;
      const t = this.data.loadTime || Date.now();
      return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
    }
  }
});