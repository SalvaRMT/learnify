
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div className="flex justify-center items-center h-full">
      <Loader2 className="animate-spin text-primary" size={size} />
    </div>
  );
}
