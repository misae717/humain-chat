export interface HumainChatSettings {
	enabled: boolean;
	autoOpenOnStart: boolean;
	compactUI: boolean;
	accentColor: string;
	gradientEnabled: boolean;
	gradientStart: string;
	gradientEnd: string;
	gradientAngle: string;
	glassBlur: string;
	glassOpacity: string;
	animatedGradient: boolean;
	oceanEnabled?: boolean;
	noiseEnabled?: boolean;
	oceanIntensity?: number; // 0.0 - 1.0
}

export const DEFAULT_SETTINGS: HumainChatSettings = {
	enabled: true,
	autoOpenOnStart: true,
	compactUI: false,
	accentColor: '#00D49C',
	gradientEnabled: true,
	gradientStart: '#a8f374',
	gradientEnd: '#00bfa5',
	gradientAngle: '180deg',
	glassBlur: '10px',
	glassOpacity: '0.65'
,
	animatedGradient: true
,
	oceanEnabled: true,
	noiseEnabled: true,
	oceanIntensity: 0.6
};

export const VIEW_TYPE_CHAT = 'humain-chat-view';


