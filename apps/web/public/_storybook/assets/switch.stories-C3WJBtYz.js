import{J as s,j as e,C as n,e as d,f as c,m,g as u,c as o}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const h={title:"Forms/Switch",component:s,tags:["autodocs"],args:{label:"Show sub-issues",size:"md",disabled:!1,labelPosition:"after"},argTypes:{size:{control:"inline-radio",options:["sm","md"]},labelPosition:{control:"inline-radio",options:["after","before"]}},parameters:{docs:{description:{component:"An on/off setting that takes effect immediately."}}}},t={},i={render:()=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(s,{size:"sm",label:"Small",defaultChecked:!0}),e.jsx(s,{size:"md",label:"Medium",defaultChecked:!0}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(s,{size:"sm","aria-label":"Small, no label"}),e.jsx(s,{"aria-label":"Medium, no label"})]})]})},r={args:{label:"Auto-close stale issues",description:"Close issues with no activity for 6 months.",defaultChecked:!0}},l={render:()=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(s,{label:"Off"}),e.jsx(s,{label:"On",defaultChecked:!0}),e.jsx(s,{label:"Disabled",disabled:!0}),e.jsx(s,{label:"Disabled, on",disabled:!0,defaultChecked:!0})]})},a={render:()=>e.jsxs(n,{className:"w-[440px]",children:[e.jsxs(d,{children:[e.jsx(c,{children:"Notifications"}),e.jsx(m,{children:"Choose what reaches your inbox."})]}),e.jsxs(u,{className:"flex flex-col gap-3",children:[e.jsx(s,{labelPosition:"before",label:"Assigned to me",description:"When someone assigns you an issue.",defaultChecked:!0}),e.jsx(o,{}),e.jsx(s,{labelPosition:"before",label:"Mentions",description:"When someone @mentions you in a comment.",defaultChecked:!0}),e.jsx(o,{}),e.jsx(s,{labelPosition:"before",label:"Status changes",description:"When an issue you created changes status."}),e.jsx(o,{}),e.jsx(s,{labelPosition:"before",label:"Weekly digest",description:"Available on the Business plan.",disabled:!0})]})]})},f=["Playground","Sizes","WithDescription","States","SettingsList"];t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-3">
      <Switch size="sm" label="Small" defaultChecked />
      <Switch size="md" label="Medium" defaultChecked />
      <div className="flex items-center gap-3">
        <Switch size="sm" aria-label="Small, no label" />
        <Switch aria-label="Medium, no label" />
      </div>
    </div>
}`,...i.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Auto-close stale issues",
    description: "Close issues with no activity for 6 months.",
    defaultChecked: true
  }
}`,...r.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-3">
      <Switch label="Off" />
      <Switch label="On" defaultChecked />
      <Switch label="Disabled" disabled />
      <Switch label="Disabled, on" disabled defaultChecked />
    </div>
}`,...l.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-[440px]">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose what reaches your inbox.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Switch labelPosition="before" label="Assigned to me" description="When someone assigns you an issue." defaultChecked />
        <Separator />
        <Switch labelPosition="before" label="Mentions" description="When someone @mentions you in a comment." defaultChecked />
        <Separator />
        <Switch labelPosition="before" label="Status changes" description="When an issue you created changes status." />
        <Separator />
        <Switch labelPosition="before" label="Weekly digest" description="Available on the Business plan." disabled />
      </CardContent>
    </Card>
}`,...a.parameters?.docs?.source},description:{story:"Label first and the switch at the far right, like Linear's preferences.",...a.parameters?.docs?.description}}};export{t as Playground,a as SettingsList,i as Sizes,l as States,r as WithDescription,f as __namedExportsOrder,h as default};
