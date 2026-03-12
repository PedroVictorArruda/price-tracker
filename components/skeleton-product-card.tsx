export function SkeletonProductCard() {
  return (
    <div className="border rounded-lg p-4 shadow-sm w-full animate-pulse bg-white flex flex-col gap-4">
      <div className="w-full h-48 bg-gray-200 rounded-md"></div>
      <div className="flex flex-col gap-2">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
      <div className="flex justify-between items-center mt-2">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="h-6 bg-gray-200 rounded w-1/4"></div>
      </div>
    </div>
  );
}
