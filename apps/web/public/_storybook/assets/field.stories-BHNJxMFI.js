import{F as n,j as s,p as o}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const d={title:"Forms/Field",component:n,tags:["autodocs"],args:{label:"Workspace URL",description:"Lowercase letters, numbers and dashes.",error:"",optional:!1,children:s.jsx(o,{placeholder:"acme"})},decorators:[t=>s.jsx("div",{className:"w-80",children:s.jsx(t,{})})],parameters:{docs:{description:{component:"Label, control, help text and error wired together: the control gets an id,\n`aria-describedby` and `aria-invalid` automatically."}}}},e={},r={args:{error:"This URL is already taken.",children:s.jsx(o,{defaultValue:"acme"})}},a={args:{label:"Display name",optional:!0,description:void 0}},l=["Playground","WithError","Optional"];e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:"{}",...e.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    error: "This URL is already taken.",
    children: <Input defaultValue="acme" />
  }
}`,...r.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    label: "Display name",
    optional: true,
    description: undefined
  }
}`,...a.parameters?.docs?.source}}};export{a as Optional,e as Playground,r as WithError,l as __namedExportsOrder,d as default};
