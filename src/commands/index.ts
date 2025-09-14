import type HumainChatPlugin from '../main';

export function registerCommands(plugin: HumainChatPlugin) {
	plugin.addCommand({
		id: 'humain-open-chat-view',
		name: 'Open HUMAIN Chat',
		callback: async () => {
			await plugin.activateChatView();
		},
	});
}



