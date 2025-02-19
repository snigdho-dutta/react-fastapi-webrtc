import { IOClientContext } from '@/context/io-client'
import React from 'react'

export const useIOClient = () => React.useContext(IOClientContext)
