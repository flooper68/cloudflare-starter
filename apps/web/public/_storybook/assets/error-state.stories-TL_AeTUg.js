import{aW as i,j as e,C as c,B as d}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const m={title:"Feedback/ErrorState",component:i,tags:["autodocs"],args:{variant:"page",title:"Couldn't load issues",description:"The server didn't answer. Check your connection and try again.",onRetry:()=>new Promise(r=>setTimeout(r,1200))},argTypes:{variant:{control:"inline-radio",options:["page","compact","inline"]}},parameters:{docs:{description:{component:"Failure, explained: what happened and a way forward. Pair with Skeleton (loading) and\nEmptyState (nothing to show); `DataState` picks between all four."}}}},a={},t={args:{secondaryAction:e.jsx(d,{variant:"ghost",size:"sm",children:"Go to dashboard"}),details:"GET /api/trpc/issues.list → 503 · request id 7f3c2a1e"}},s={render:()=>e.jsxs(c,{className:"w-96 p-0",children:[e.jsx("div",{className:"border-b border-line px-4 py-3 text-sm font-medium",children:"Cycle burndown"}),e.jsx(i,{variant:"compact",title:"Chart unavailable",description:"Cycle data is still being calculated.",onRetry:()=>new Promise(r=>setTimeout(r,800))})]})},o={render:()=>e.jsx("div",{className:"w-96",children:e.jsx(i,{variant:"inline",description:"Couldn't save the title.",onRetry:()=>new Promise(r=>setTimeout(r,800))})})},n={args:{description:void 0,error:new Error("You don't have access to this project."),title:"No access",onRetry:void 0}},u=["Playground","Page","InACard","Inline","FromAnError"];a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:"{}",...a.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    secondaryAction: <Button variant="ghost" size="sm">
        Go to dashboard
      </Button>,
    details: "GET /api/trpc/issues.list → 503 · request id 7f3c2a1e"
  }
}`,...t.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-96 p-0">
      <div className="border-b border-line px-4 py-3 text-sm font-medium">
        Cycle burndown
      </div>
      <ErrorState variant="compact" title="Chart unavailable" description="Cycle data is still being calculated." onRetry={() => new Promise(resolve => setTimeout(resolve, 800))} />
    </Card>
}`,...s.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="w-96">
      <ErrorState variant="inline" description="Couldn't save the title." onRetry={() => new Promise(resolve => setTimeout(resolve, 800))} />
    </div>
}`,...o.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    description: undefined,
    error: new Error("You don't have access to this project."),
    title: "No access",
    onRetry: undefined
  }
}`,...n.parameters?.docs?.source}}};export{n as FromAnError,s as InACard,o as Inline,t as Page,a as Playground,u as __namedExportsOrder,m as default};
