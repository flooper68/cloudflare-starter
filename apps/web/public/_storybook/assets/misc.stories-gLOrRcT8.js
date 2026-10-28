import{j as e,H as n,T as s,S as o,K as c,c as l,d}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const p={title:"Foundations/Primitives",parameters:{layout:"padded",docs:{description:{component:"Small building blocks: keys, separators, spinner, headings and text."}}}},a={render:()=>e.jsxs("div",{className:"flex flex-col gap-3 text-sm text-fg-muted",children:[e.jsxs("span",{className:"flex items-center gap-2",children:["Command menu ",e.jsx(o,{keys:["⌘","K"]})]}),e.jsxs("span",{className:"flex items-center gap-2",children:["Create issue ",e.jsx(c,{children:"C"})]}),e.jsxs("span",{className:"flex items-center gap-2",children:["Go to inbox ",e.jsx(c,{children:"G"})," then ",e.jsx(c,{children:"I"})]})]})},t={render:()=>e.jsxs("div",{className:"flex items-center gap-4 text-fg-muted",children:[e.jsx(d,{className:"size-3"}),e.jsx(d,{}),e.jsx(d,{className:"size-6 text-accent",label:"Loading issues"})]})},r={render:()=>e.jsxs("div",{className:"flex w-80 flex-col gap-3",children:[e.jsx(s,{children:"Above"}),e.jsx(l,{}),e.jsxs("div",{className:"flex h-5 items-center gap-3 text-sm text-fg-muted",children:["Issues ",e.jsx(l,{orientation:"vertical"})," Projects"," ",e.jsx(l,{orientation:"vertical"})," Views"]})]})},i={render:()=>e.jsxs("div",{className:"flex max-w-xl flex-col gap-3",children:[e.jsx(n,{level:1,children:"Engineering"}),e.jsx(n,{level:2,children:"Current cycle"}),e.jsx(n,{level:3,children:"Billing migration"}),e.jsx(n,{level:4,children:"Acceptance criteria"}),e.jsx(s,{children:"Body text in the default tone."}),e.jsx(s,{tone:"muted",children:"Muted text for secondary information."}),e.jsx(s,{tone:"subtle",size:"xs",children:"Subtle metadata · updated 2h ago"}),e.jsx(s,{tone:"danger",size:"xs",children:"Something went wrong."})]})},g=["Keys","Spinners","Separators","HeadingsAndText"];a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-3 text-sm text-fg-muted">
      <span className="flex items-center gap-2">
        Command menu <Shortcut keys={["⌘", "K"]} />
      </span>
      <span className="flex items-center gap-2">
        Create issue <Kbd>C</Kbd>
      </span>
      <span className="flex items-center gap-2">
        Go to inbox <Kbd>G</Kbd> then <Kbd>I</Kbd>
      </span>
    </div>
}`,...a.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-4 text-fg-muted">
      <Spinner className="size-3" />
      <Spinner />
      <Spinner className="size-6 text-accent" label="Loading issues" />
    </div>
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex w-80 flex-col gap-3">
      <Text>Above</Text>
      <Separator />
      <div className="flex h-5 items-center gap-3 text-sm text-fg-muted">
        Issues <Separator orientation="vertical" /> Projects{" "}
        <Separator orientation="vertical" /> Views
      </div>
    </div>
}`,...r.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex max-w-xl flex-col gap-3">
      <Heading level={1}>Engineering</Heading>
      <Heading level={2}>Current cycle</Heading>
      <Heading level={3}>Billing migration</Heading>
      <Heading level={4}>Acceptance criteria</Heading>
      <Text>Body text in the default tone.</Text>
      <Text tone="muted">Muted text for secondary information.</Text>
      <Text tone="subtle" size="xs">
        Subtle metadata · updated 2h ago
      </Text>
      <Text tone="danger" size="xs">
        Something went wrong.
      </Text>
    </div>
}`,...i.parameters?.docs?.source}}};export{i as HeadingsAndText,a as Keys,r as Separators,t as Spinners,g as __namedExportsOrder,p as default};
