import React from 'react';
import StudentLogin from './StudentLogin';
import StudentRegister from './StudentRegister';

export default function Auth({ register = false }) {
  if (register) {
    return <StudentRegister />;
  }
  return <StudentLogin />;
}
