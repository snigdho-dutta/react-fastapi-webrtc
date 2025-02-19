import React from 'react'
import { cn } from '../../lib/utils'

const Page: React.FC<
  React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>
> = ({ children, className, ...props }) => {
  return (
    <main
      className={cn(
        'h-screen w-screen flex flex-col justify-center items-center place-items-center overflow-auto',
        className
      )}
      {...props}
    >
      {children}
    </main>
  )
}

export default Page
