import{C as n,j as e,f as i,b4 as m,m as d,e as c,g as p,G as u,B as o}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const h={title:"Data display/Card",component:n,tags:["autodocs"],args:{interactive:!1},parameters:{docs:{description:{component:"A bordered panel for grouping related content. `interactive` adds hover feedback."}}}},r={render:s=>e.jsxs(n,{...s,className:"w-80",children:[e.jsxs(c,{children:[e.jsx(i,{children:"Q4 roadmap"}),e.jsx(d,{children:"12 issues · due Dec 20"})]}),e.jsx(p,{className:"text-sm text-fg-muted",children:"Ship the billing migration and the new onboarding before the holiday freeze."})]})},a={render:()=>e.jsxs(n,{className:"w-96",children:[e.jsxs(c,{children:[e.jsx(i,{children:"Invite your team"}),e.jsx(d,{children:"Members can create issues, comment and connect their agents."})]}),e.jsxs(u,{className:"justify-end",children:[e.jsx(o,{variant:"ghost",children:"Later"}),e.jsx(o,{variant:"primary",children:"Send invites"})]})]})},t={render:()=>e.jsx("div",{className:"grid w-[640px] grid-cols-2 gap-3",children:[["Mobile app","38 issues · 64% done"],["Billing v2","21 issues · 12% done"],["Agent API","9 issues · in review"],["Docs refresh","5 issues · planned"]].map(([s,l])=>e.jsxs(n,{interactive:!0,children:[e.jsxs("div",{className:"flex items-start justify-between",children:[e.jsx(i,{className:"text-sm",children:s}),e.jsx(m,{className:"size-4 text-fg-subtle"})]}),e.jsx(d,{className:"mt-1 text-xs",children:l})]},s))})},C=["Playground","WithFooter","Interactive"];r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: args => <Card {...args} className="w-80">
      <CardHeader>
        <CardTitle>Q4 roadmap</CardTitle>
        <CardDescription>12 issues · due Dec 20</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-fg-muted">
        Ship the billing migration and the new onboarding before the holiday
        freeze.
      </CardContent>
    </Card>
}`,...r.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-96">
      <CardHeader>
        <CardTitle>Invite your team</CardTitle>
        <CardDescription>
          Members can create issues, comment and connect their agents.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-end">
        <Button variant="ghost">Later</Button>
        <Button variant="primary">Send invites</Button>
      </CardFooter>
    </Card>
}`,...a.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => <div className="grid w-[640px] grid-cols-2 gap-3">
      {[["Mobile app", "38 issues · 64% done"], ["Billing v2", "21 issues · 12% done"], ["Agent API", "9 issues · in review"], ["Docs refresh", "5 issues · planned"]].map(([title, meta]) => <Card key={title} interactive>
          <div className="flex items-start justify-between">
            <CardTitle className="text-sm">{title}</CardTitle>
            <ArrowUpRight className="size-4 text-fg-subtle" />
          </div>
          <CardDescription className="mt-1 text-xs">{meta}</CardDescription>
        </Card>)}
    </div>
}`,...t.parameters?.docs?.source}}};export{t as Interactive,r as Playground,a as WithFooter,C as __namedExportsOrder,h as default};
