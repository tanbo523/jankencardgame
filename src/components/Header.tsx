import Link from 'next/link';

const Header = () => {
  return (
    <header className="fixed top-0 right-0 p-4">
      <Link href="/" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
        メニュー
      </Link>
    </header>
  );
};

export default Header; 