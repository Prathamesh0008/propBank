"use client";

import React from 'react';
import GoogleAuth from './GoogleAuth';

const Auth: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="mb-4 px-6 pt-6 pb-4 text-center bg-gradient-to-b from-white to-gray-50">
              <div className="mx-auto w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
                <span className="text-xl font-bold text-white">PB</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome to Propbank</h1>
              <p className="text-gray-600 text-sm">Sign in to continue to your account</p>
            </div>
            <div className="px-6 pb-6"><GoogleAuth /></div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
