import{bb as t,j as e}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const l={title:"Navigation/Link",component:t,tags:["autodocs"],args:{children:"cycle settings",href:"#settings",variant:"default",external:!1},argTypes:{variant:{control:"inline-radio",options:["default","subtle","muted"]}},parameters:{docs:{description:{component:"Inline text links. `default` (accent) in running text, `subtle` where accent is too\nloud, `muted` for footers. `external` opens a new tab and shows ↗."}}}},r={},s={render:()=>e.jsxs("div",{className:"flex items-center gap-4 text-sm",children:[e.jsx(t,{href:"#a",children:"Default"}),e.jsx(t,{href:"#b",variant:"subtle",children:"Subtle"}),e.jsx(t,{href:"#c",variant:"muted",children:"Muted"})]})},n={args:{children:"Cloudflare docs",href:"https://developers.cloudflare.com",external:!0}},a={render:()=>e.jsxs("p",{className:"w-96 text-sm text-fg-muted",children:["Unfinished issues move to the next cycle automatically. Change this in"," ",e.jsx(t,{href:"#settings",children:"cycle settings"}),", or read how"," ",e.jsx(t,{href:"https://example.com/guides/cycles",external:!0,children:"other teams run cycles"}),"."]})},o={render:()=>e.jsx(t,{asChild:!0,variant:"subtle",children:e.jsx("button",{type:"button",children:"Rendered as a button via asChild"})})},d=["Playground","Variants","External","InText","AsChild"];r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-4 text-sm">
      <Link href="#a">Default</Link>
      <Link href="#b" variant="subtle">
        Subtle
      </Link>
      <Link href="#c" variant="muted">
        Muted
      </Link>
    </div>
}`,...s.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    children: "Cloudflare docs",
    href: "https://developers.cloudflare.com",
    external: true
  }
}`,...n.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <p className="w-96 text-sm text-fg-muted">
      Unfinished issues move to the next cycle automatically. Change this in{" "}
      <Link href="#settings">cycle settings</Link>, or read how{" "}
      <Link href="https://example.com/guides/cycles" external>
        other teams run cycles
      </Link>
      .
    </p>
}`,...a.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <Link asChild variant="subtle">
      <button type="button">Rendered as a button via asChild</button>
    </Link>
}`,...o.parameters?.docs?.source}}};export{o as AsChild,n as External,a as InText,r as Playground,s as Variants,d as __namedExportsOrder,l as default};
