// Future delivery workers can implement this contract without changing operations.
// The notification ID is the idempotency key on every retry. In-app delivery is
// the existing transactional Notification record, so it needs no external call.
export interface NotificationDeliveryAdapter {
  channel: 'EMAIL' | 'PUSH' | 'WHATSAPP';
  deliver(notification: {
    id: string;
    schoolId: string;
    recipientId: string;
    title: string;
    message: string;
  }): Promise<{ delivered: boolean; retryable: boolean; externalId?: string }>;
}
