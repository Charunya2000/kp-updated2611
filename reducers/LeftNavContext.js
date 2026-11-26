import React, { createContext, useContext, useState } from 'react';

const LeftNavContext = createContext();

export const LeftNavProvider = ({ children }) => {
  const [isLeftNavVisible, setIsLeftNavVisible] = useState(true);

  return (
    <LeftNavContext.Provider value={{ isLeftNavVisible, setIsLeftNavVisible }}>
      {children}
    </LeftNavContext.Provider>
  );
};

export const useLeftNav = () => useContext(LeftNavContext);