export class CreateNotificationDto { recipientId?: string; channel!: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP'; title!: string; message!: string; }
