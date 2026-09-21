import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

describe('Tooltip', () => {
  it('renders trigger with provider without crashing in SSR', () => {
    const html = renderToString(
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button">Trigger Button</button>
          </TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )

    expect(html).toContain('Trigger Button')
    expect(html).toContain('data-slot="tooltip-trigger"')
  })
})
