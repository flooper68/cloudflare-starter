import{h as a,j as e,b3 as p,C as d,e as u,f as x,m as g,aS as v}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const r=["Ada Lovelace","Grace Hopper","Alan Turing","Katherine Johnson","Linus Torvalds","Margaret Hamilton","Dennis Ritchie","Barbara Liskov"],f=`data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5e6ad2"/><stop offset="1" stop-color="#26b5ce"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="32" cy="26" r="11" fill="#fff" fill-opacity=".85"/><rect x="14" y="42" width="36" height="24" rx="12" fill="#fff" fill-opacity=".85"/></svg>')}`,z={title:"Data display/Avatar",component:a,tags:["autodocs"],args:{name:"Ada Lovelace",size:"lg"},argTypes:{size:{control:"inline-radio",options:["xs","sm","md","lg"]},status:{control:"select",options:[void 0,"online","away","busy","offline"]},shape:{control:"inline-radio",options:["circle","square"]}},parameters:{docs:{description:{component:`Avatars stand for people and teams. Without an image (or while it loads) they show
initials on a colour derived from the name, so the same person always looks the same.`}}}},n={},t={render:()=>e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(a,{name:"Grace Hopper",size:"xs"}),e.jsx(a,{name:"Grace Hopper",size:"sm"}),e.jsx(a,{name:"Grace Hopper",size:"md"}),e.jsx(a,{name:"Grace Hopper",size:"lg"})]})},i={render:()=>e.jsx("div",{className:"flex flex-wrap items-center gap-2",children:r.map(s=>e.jsx(a,{name:s,size:"lg"},s))})},o={render:()=>e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(a,{name:"Alan Turing",src:f,size:"lg"}),e.jsx(a,{name:"Broken Image",src:"https://invalid.example/missing.png",size:"lg"}),e.jsx(a,{name:"Platform team",shape:"square",size:"lg"})]})},l={render:()=>e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx(a,{name:"Ada Lovelace",status:"online",size:"lg"}),e.jsx(a,{name:"Grace Hopper",status:"away",size:"lg"}),e.jsx(a,{name:"Alan Turing",status:"busy",size:"lg"}),e.jsx(a,{name:"Katherine Johnson",status:"offline",size:"lg"}),e.jsx(a,{name:"Linus Torvalds",status:"online",size:"md"}),e.jsx(a,{name:"Linus Torvalds",status:"online",size:"sm"})]})},m={render:()=>e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsx(p,{size:"sm",max:3,children:r.slice(0,3).map(s=>e.jsx(a,{name:s},s))}),e.jsx(p,{size:"md",max:4,children:r.map(s=>e.jsx(a,{name:s},s))}),e.jsx(p,{size:"lg",max:5,children:r.map(s=>e.jsx(a,{name:s},s))})]})},c={render:()=>e.jsxs(d,{className:"w-96",children:[e.jsxs(u,{children:[e.jsx(x,{children:"Billing v2"}),e.jsx(g,{children:"Lead and members"})]}),e.jsxs("div",{className:"mt-3 flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2 text-sm",children:[e.jsx(a,{name:"Margaret Hamilton",status:"online"}),e.jsx("span",{className:"text-fg",children:"Margaret Hamilton"})]}),e.jsx(p,{size:"sm",max:3,children:r.slice(1,7).map(s=>e.jsx(v,{content:s,children:e.jsx("button",{type:"button","aria-label":s,className:"inline-flex rounded-full focus-visible:ring-2 focus-visible:ring-focus outline-none",children:e.jsx(a,{name:s})})},s))})]})]})},A=["Playground","Sizes","InitialsFallback","WithImage","Status","Group","InContext"];n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:"{}",...n.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-3">
      <Avatar name="Grace Hopper" size="xs" />
      <Avatar name="Grace Hopper" size="sm" />
      <Avatar name="Grace Hopper" size="md" />
      <Avatar name="Grace Hopper" size="lg" />
    </div>
}`,...t.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap items-center gap-2">
      {people.map(name => <Avatar key={name} name={name} size="lg" />)}
    </div>
}`,...i.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-3">
      <Avatar name="Alan Turing" src={photo} size="lg" />
      <Avatar name="Broken Image" src="https://invalid.example/missing.png" size="lg" />
      <Avatar name="Platform team" shape="square" size="lg" />
    </div>
}`,...o.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-4">
      <Avatar name="Ada Lovelace" status="online" size="lg" />
      <Avatar name="Grace Hopper" status="away" size="lg" />
      <Avatar name="Alan Turing" status="busy" size="lg" />
      <Avatar name="Katherine Johnson" status="offline" size="lg" />
      <Avatar name="Linus Torvalds" status="online" size="md" />
      <Avatar name="Linus Torvalds" status="online" size="sm" />
    </div>
}`,...l.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex flex-col gap-4">
      <AvatarGroup size="sm" max={3}>
        {people.slice(0, 3).map(name => <Avatar key={name} name={name} />)}
      </AvatarGroup>
      <AvatarGroup size="md" max={4}>
        {people.map(name => <Avatar key={name} name={name} />)}
      </AvatarGroup>
      <AvatarGroup size="lg" max={5}>
        {people.map(name => <Avatar key={name} name={name} />)}
      </AvatarGroup>
    </div>
}`,...m.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-96">
      <CardHeader>
        <CardTitle>Billing v2</CardTitle>
        <CardDescription>Lead and members</CardDescription>
      </CardHeader>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Avatar name="Margaret Hamilton" status="online" />
          <span className="text-fg">Margaret Hamilton</span>
        </div>
        <AvatarGroup size="sm" max={3}>
          {people.slice(1, 7).map(name => <Tooltip key={name} content={name}>
              <button type="button" aria-label={name} className="inline-flex rounded-full focus-visible:ring-2 focus-visible:ring-focus outline-none">
                <Avatar name={name} />
              </button>
            </Tooltip>)}
        </AvatarGroup>
      </div>
    </Card>
}`,...c.parameters?.docs?.source}}};export{m as Group,c as InContext,i as InitialsFallback,n as Playground,t as Sizes,l as Status,o as WithImage,A as __namedExportsOrder,z as default};
