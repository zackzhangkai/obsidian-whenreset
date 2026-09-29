import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type WhenresetPlugin from './main.ts';

export class WhenresetSettingTab extends PluginSettingTab {
  private plugin: WhenresetPlugin;

  constructor(app: App, plugin: WhenresetPlugin) { super(app, plugin); this.plugin = plugin; }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: '重置雷达' });

    new Setting(containerEl)
      .setName('数据源地址')
      .setDesc('默认 https://whenreset.uk/api/radar.json,只读取公开 JSON。')
      .addText(text => text
        .setPlaceholder('https://whenreset.uk/api/radar.json')
        .setValue(this.plugin.settings.dataUrl)
        .onChange(async (value) => {
          const url = value.trim();
          if (!/^https:\/\//.test(url)) return; // 仅接受 https
          this.plugin.settings.dataUrl = url;
          await this.plugin.savePluginData();
          this.plugin.store.setUrl(url);
        }));

    new Setting(containerEl)
      .setName('自动刷新间隔')
      .setDesc('定时拉取公开数据,默认 15 分钟(与站点采集节奏一致)。')
      .addDropdown(drop => drop
        .addOptions({ '5': '5 分钟', '10': '10 分钟', '15': '15 分钟', '30': '30 分钟', '60': '60 分钟' })
        .setValue(String(this.plugin.settings.refreshMinutes))
        .onChange(async (value) => {
          this.plugin.settings.refreshMinutes = Number(value);
          await this.plugin.savePluginData();
          this.plugin.applySchedule(false);
        }));

    new Setting(containerEl)
      .setName('新公告通知')
      .setDesc('出现新的已宣布重置 / 发卡 / 预告时弹出 Obsidian 通知。')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.notify)
        .onChange(async (value) => {
          this.plugin.settings.notify = value;
          await this.plugin.savePluginData();
        }));

    containerEl.createEl('p', { text: '数据与预测来自 whenreset.uk 公开雷达;公开消息不等于官方公告,倒计时到零不代表已重置。' })
      .addClass('whenreset-settings-note');
  }
}
