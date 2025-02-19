import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Page from '@/components/ui/page'

const NotFoundPage = () => {
  return (
    <Page>
      <Card className='min-w-1/2 min-h-1/2'>
        <CardContent className='flex h-full bg-rose-50 text-red-500 p-4 pt-8 flex-col justify-between items-center text-xl'>
          <h1 className='text-3xl'>Error!</h1>
          <p>Page not found!</p>
          <span className='text-3xl'>:(</span>
          <Button>
            <a href='/'>Home</a>
          </Button>
        </CardContent>
      </Card>
    </Page>
  )
}

export default NotFoundPage
