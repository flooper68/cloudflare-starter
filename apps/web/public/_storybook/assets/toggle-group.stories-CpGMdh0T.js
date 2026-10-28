import{a6 as l,cY as t,j as e,cZ as a,c as f}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const p={name:"bold",size:24,node:[["path",{d:"M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8",key:"mg9rjx"}]]};p.node;const u=l(p);const m={name:"code",size:24,node:[["path",{d:"m16 18 6-6-6-6",key:"eg8j8"}],["path",{d:"m8 6-6 6 6 6",key:"ppft3o"}]]};m.node;const b=l(m);const x={name:"italic",size:24,node:[["line",{x1:"19",x2:"10",y1:"4",y2:"4",key:"15jd3p"}],["line",{x1:"14",x2:"5",y1:"20",y2:"20",key:"bu0au3"}],["line",{x1:"15",x2:"9",y1:"4",y2:"20",key:"uljnxc"}]]};x.node;const g=l(x);const y={name:"link",size:24,node:[["path",{d:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",key:"1cjeqo"}],["path",{d:"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",key:"19qd67"}]]};y.node;const I=l(y);const h={name:"strikethrough",size:24,node:[["path",{d:"M16 4H9a3 3 0 0 0-2.83 4",key:"43sutm"}],["path",{d:"M14 12a4 4 0 0 1 0 8H6",key:"nlfj13"}],["line",{x1:"4",x2:"20",y1:"12",y2:"12",key:"1e0a9i"}]]};h.node;const j=l(h);const v={name:"text-align-center",size:24,node:[["path",{d:"M21 5H3",key:"1fi0y6"}],["path",{d:"M17 12H7",key:"16if0g"}],["path",{d:"M19 19H5",key:"vjpgq2"}]],aliases:["align-center"]};v.node;const G=l(v);const k={name:"text-align-end",size:24,node:[["path",{d:"M21 5H3",key:"1fi0y6"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M21 19H7",key:"4cu937"}]],aliases:["align-right"]};k.node;const z=l(k);const T={name:"text-align-start",size:24,node:[["path",{d:"M21 5H3",key:"1fi0y6"}],["path",{d:"M15 12H3",key:"6jk70r"}],["path",{d:"M17 19H3",key:"z6ezky"}]],aliases:["text","align-left"]};T.node;const S=l(T),M={title:"Forms/ToggleGroup",component:t,tags:["autodocs"],args:{type:"multiple",size:"md",disabled:!1,"aria-label":"Formatting"},argTypes:{size:{control:"inline-radio",options:["sm","md"]}},render:d=>e.jsxs(t,{type:"multiple",size:d.size,disabled:d.disabled,"aria-label":d["aria-label"],defaultValue:["bold"],children:[e.jsx(a,{value:"bold",icon:e.jsx(u,{}),label:"Bold"}),e.jsx(a,{value:"italic",icon:e.jsx(g,{}),label:"Italic"}),e.jsx(a,{value:"strike",icon:e.jsx(j,{}),label:"Strikethrough"}),e.jsx(a,{value:"code",icon:e.jsx(b,{}),label:"Inline code"})]}),parameters:{docs:{description:{component:'Toggle buttons in a row. `type="multiple"` for independent toggles (text formatting),\n`type="single"` for at most one (alignment). Icon-only items need `label`.'}}}},r={},n={args:{size:"sm"}},i={render:()=>e.jsxs(t,{type:"single",defaultValue:"left","aria-label":"Alignment",children:[e.jsx(a,{value:"left",icon:e.jsx(S,{}),label:"Align left"}),e.jsx(a,{value:"center",icon:e.jsx(G,{}),label:"Align center"}),e.jsx(a,{value:"right",icon:e.jsx(z,{}),label:"Align right"})]})},s={render:()=>e.jsxs(t,{type:"multiple",defaultValue:["mine"],"aria-label":"Quick filters",children:[e.jsx(a,{value:"mine",children:"Assigned to me"}),e.jsx(a,{value:"created",children:"Created by me"}),e.jsx(a,{value:"subscribed",children:"Subscribed"})]})},c={render:()=>e.jsxs(t,{type:"multiple",defaultValue:["bold"],disabled:!0,"aria-label":"Formatting",children:[e.jsx(a,{value:"bold",icon:e.jsx(u,{}),label:"Bold"}),e.jsx(a,{value:"italic",icon:e.jsx(g,{}),label:"Italic"})]})},o={render:()=>e.jsxs("div",{className:"w-[420px] rounded-lg border border-line bg-surface-raised",children:[e.jsxs("div",{className:"flex items-center gap-1 border-line border-b px-1.5 py-1",children:[e.jsxs(t,{type:"multiple",size:"sm","aria-label":"Formatting",children:[e.jsx(a,{value:"bold",icon:e.jsx(u,{}),label:"Bold"}),e.jsx(a,{value:"italic",icon:e.jsx(g,{}),label:"Italic"}),e.jsx(a,{value:"strike",icon:e.jsx(j,{}),label:"Strikethrough"})]}),e.jsx(f,{orientation:"vertical",className:"mx-1 h-4"}),e.jsxs(t,{type:"multiple",size:"sm","aria-label":"Insert",children:[e.jsx(a,{value:"code",icon:e.jsx(b,{}),label:"Inline code"}),e.jsx(a,{value:"link",icon:e.jsx(I,{}),label:"Link"})]})]}),e.jsx("p",{className:"px-3 py-3 text-fg-subtle text-sm",children:"Leave a comment…"})]})},H=["Playground","Small","Single","WithText","Disabled","EditorToolbar"];r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:"{}",...r.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    size: "sm"
  }
}`,...n.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <ToggleGroup type="single" defaultValue="left" aria-label="Alignment">
      <ToggleGroupItem value="left" icon={<AlignLeft />} label="Align left" />
      <ToggleGroupItem value="center" icon={<AlignCenter />} label="Align center" />
      <ToggleGroupItem value="right" icon={<AlignRight />} label="Align right" />
    </ToggleGroup>
}`,...i.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <ToggleGroup type="multiple" defaultValue={["mine"]} aria-label="Quick filters">
      <ToggleGroupItem value="mine">Assigned to me</ToggleGroupItem>
      <ToggleGroupItem value="created">Created by me</ToggleGroupItem>
      <ToggleGroupItem value="subscribed">Subscribed</ToggleGroupItem>
    </ToggleGroup>
}`,...s.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <ToggleGroup type="multiple" defaultValue={["bold"]} disabled aria-label="Formatting">
      <ToggleGroupItem value="bold" icon={<Bold />} label="Bold" />
      <ToggleGroupItem value="italic" icon={<Italic />} label="Italic" />
    </ToggleGroup>
}`,...c.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="w-[420px] rounded-lg border border-line bg-surface-raised">
      <div className="flex items-center gap-1 border-line border-b px-1.5 py-1">
        <ToggleGroup type="multiple" size="sm" aria-label="Formatting">
          <ToggleGroupItem value="bold" icon={<Bold />} label="Bold" />
          <ToggleGroupItem value="italic" icon={<Italic />} label="Italic" />
          <ToggleGroupItem value="strike" icon={<Strikethrough />} label="Strikethrough" />
        </ToggleGroup>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ToggleGroup type="multiple" size="sm" aria-label="Insert">
          <ToggleGroupItem value="code" icon={<Code />} label="Inline code" />
          <ToggleGroupItem value="link" icon={<Link />} label="Link" />
        </ToggleGroup>
      </div>
      <p className="px-3 py-3 text-fg-subtle text-sm">Leave a comment…</p>
    </div>
}`,...o.parameters?.docs?.source},description:{story:"A comment editor toolbar.",...o.parameters?.docs?.description}}};export{c as Disabled,o as EditorToolbar,r as Playground,i as Single,n as Small,s as WithText,H as __namedExportsOrder,M as default};
