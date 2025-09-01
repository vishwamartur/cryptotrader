import { NextPageContext } from 'next';

interface ErrorProps {
  statusCode?: number;
  hasGetInitialProps?: boolean;
  err?: Error;
}

function Error({ statusCode, hasGetInitialProps, err }: ErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
          {statusCode || 'Error'}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
          {statusCode === 404
            ? 'This page could not be found.'
            : hasGetInitialProps
            ? `A ${statusCode} error occurred on server`
            : 'An error occurred on client'}
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
