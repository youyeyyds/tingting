// cards/index.js
const app = getApp();

Page({
  data: {
    cards: [],
    currentIndex: 0,
    currentCard: null,
    isFlipped: false,
    loading: true,
    headerHeight: 0
  },

  onLoad() {
    this.initLayout();
    this.loadCards();
  },

  initLayout() {
    const { statusBarHeight, windowHeight, windowWidth } = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    const headerHeight = statusBarHeight + navBarHeight;
    this.setData({ headerHeight });
  },

  async loadCards() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'courseFunctions',
        data: { type: 'getCards' }
      });
      if (res.result.success) {
        const cards = res.result.data || [];
        this.setData({
          cards,
          currentCard: cards[0] || null,
          currentIndex: 0
        });
      }
    } catch (err) {
      console.error('获取卡牌失败', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  onCardTap() {
    this.setData({ isFlipped: !this.data.isFlipped });
  },

  onPrev() {
    if (this.data.currentIndex <= 0) return;
    const newIndex = this.data.currentIndex - 1;
    this.setData({
      currentIndex: newIndex,
      currentCard: this.data.cards[newIndex],
      isFlipped: false
    });
  },

  onNext() {
    if (this.data.currentIndex >= this.data.cards.length - 1) return;
    const newIndex = this.data.currentIndex + 1;
    this.setData({
      currentIndex: newIndex,
      currentCard: this.data.cards[newIndex],
      isFlipped: false
    });
  },

  onImageLoad() {
    // 图片加载完成
  },

  onImageError() {
    wx.showToast({ title: '图片加载失败', icon: 'none' });
  }
});