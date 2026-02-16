import clsx from 'clsx';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 32, md: 48, lg: 80 };
const textSizes = { sm: 'text-xs', md: 'text-base', lg: 'text-2xl' };

const colors = [
  'bg-rose-600', 'bg-pink-600', 'bg-fuchsia-600', 'bg-purple-600',
  'bg-violet-600', 'bg-indigo-600', 'bg-blue-600', 'bg-cyan-600',
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const px = sizes[size];
  const color = colors[hashName(name) % colors.length];
  const letter = name.charAt(0).toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={px}
        height={px}
        className={clsx('rounded-full object-cover shrink-0', className)}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center shrink-0 font-bold text-white',
        color,
        textSizes[size],
        className
      )}
      style={{ width: px, height: px }}
    >
      {letter}
    </div>
  );
}
