import clsx from 'clsx';
import type { MessageWithSender } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import { Avatar } from '../ui/avatar';

interface MessageBubbleProps {
  message: MessageWithSender;
  isLeft: boolean;
}

export function MessageBubble({ message, isLeft }: MessageBubbleProps) {
  return (
    <div className={clsx('flex gap-2 max-w-[80%]', isLeft ? 'mr-auto' : 'ml-auto flex-row-reverse')}>
      <Avatar
        src={message.sender.avatar_url}
        name={message.sender.name}
        size="sm"
        className="mt-1"
      />
      <div>
        <p className={clsx('text-xs mb-1', isLeft ? 'text-white/40' : 'text-white/40 text-right')}>
          {message.sender.name}
        </p>
        <div
          className={clsx(
            'rounded-2xl px-4 py-2.5 text-sm',
            isLeft
              ? 'bg-white/5 text-white/80 rounded-tl-sm'
              : 'bg-rose-600/20 text-white/90 rounded-tr-sm'
          )}
        >
          {message.content}
        </div>
        <p className={clsx('text-[10px] mt-1', isLeft ? 'text-white/20' : 'text-white/20 text-right')}>
          {timeAgo(message.created_at)}
        </p>
      </div>
    </div>
  );
}
