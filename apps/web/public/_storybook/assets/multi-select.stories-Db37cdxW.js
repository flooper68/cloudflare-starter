import{M as a,j as e,F as b,R as x,r as y,C as j,e as C,f as w,g as T,h as V}from"./iframe-BjN4PNZi.js";import{H as F}from"./hash-BA9V96Ja.js";import"./preload-helper-PPVm8Dsz.js";const v=[{value:"bug",label:"Bug",group:"Type"},{value:"feature",label:"Feature",group:"Type"},{value:"improvement",label:"Improvement",group:"Type"},{value:"frontend",label:"Frontend",group:"Area"},{value:"backend",label:"Backend",group:"Area"},{value:"infra",label:"Infrastructure",group:"Area"},{value:"mobile",label:"Mobile",group:"Area"},{value:"security",label:"Security",group:"Area",disabled:!0,description:"Admins"}].map(r=>({...r,icon:e.jsx(F,{})})),M=["Ada Lovelace","Alan Turing","Barbara Liskov","Donald Knuth","Grace Hopper","Ken Thompson","Linus Torvalds","Margaret Hamilton","Radia Perlman"];function f(r){return{value:r.toLowerCase().replace(/\s/g,"-"),label:r,icon:e.jsx(V,{name:r,size:"xs"})}}const E=(r,s)=>new Promise((o,g)=>{const h=setTimeout(()=>{const S=r.toLowerCase();o(M.filter(A=>A.toLowerCase().includes(S)).map(f))},400);s.addEventListener("abort",()=>{clearTimeout(h),g(new DOMException("Aborted","AbortError"))})}),P={title:"Forms/MultiSelect",component:a,tags:["autodocs"],args:{options:v,defaultValue:["bug","frontend"],placeholder:"Add labels",searchPlaceholder:"Search labels…",maxVisible:3,size:"md",disabled:!1,"aria-label":"Labels"},argTypes:{size:{control:"inline-radio",options:["sm","md","lg"]},options:{control:!1}},decorators:[r=>e.jsx("div",{className:"h-96 w-80",children:e.jsx(r,{})})],parameters:{docs:{description:{component:'Pick several values. The trigger shows removable chips and collapses the rest into "+N"\n(`maxVisible`); the list stays open while toggling. Backspace in the empty search removes\nthe last value. `AsyncMultiSelect` takes the same loader as AsyncSelect.'}}}},t={},n={args:{defaultOpen:!0}},c={args:{defaultValue:[]}},l={args:{defaultValue:["bug","frontend","backend","infra","mobile"],maxVisible:2}},d={render:r=>e.jsxs("div",{className:"flex flex-col gap-3",children:[e.jsx(a,{...r,size:"sm"}),e.jsx(a,{...r,size:"md"}),e.jsx(a,{...r,size:"lg"})]})},i={render:r=>e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsx(b,{label:"Disabled",children:e.jsx(a,{...r,disabled:!0})}),e.jsx(b,{label:"Labels",error:"Add at least one Area label",children:e.jsx(a,{...r,defaultValue:["bug"]})})]})},u={render:()=>e.jsx(b,{label:"Subscribers",description:"Searches the workspace directory.",children:e.jsx(x,{loader:E,defaultValue:[f("Grace Hopper"),f("Ken Thompson")],placeholder:"Add people",searchPlaceholder:"Search people…"})})},p={render:()=>e.jsx(x,{"aria-label":"Subscribers",defaultOpen:!0,loader:(r,s)=>new Promise((o,g)=>{const h=setTimeout(()=>g(new Error("Network error")),500);s.addEventListener("abort",()=>clearTimeout(h))}),placeholder:"Add people"})},m={render:function(){const[s,o]=y.useState(["feature","mobile"]);return e.jsxs(j,{className:"w-96",children:[e.jsx(C,{children:e.jsx(w,{children:"Filter issues"})}),e.jsx(T,{className:"flex flex-col gap-3",children:e.jsx(b,{label:"Labels",description:`${s.length} selected`,children:e.jsx(a,{options:v,value:s,onValueChange:o,placeholder:"Any label"})})})]})}},z=["Playground","Open","Empty","Collapsed","Sizes","States","Async","AsyncError","InAForm"];t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    defaultOpen: true
  }
}`,...n.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: []
  }
}`,...c.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: ["bug", "frontend", "backend", "infra", "mobile"],
    maxVisible: 2
  }
}`,...l.parameters?.docs?.source},description:{story:'Five values with `maxVisible={2}`: two chips and "+3".',...l.parameters?.docs?.description}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex flex-col gap-3">
      <MultiSelect {...args} size="sm" />
      <MultiSelect {...args} size="md" />
      <MultiSelect {...args} size="lg" />
    </div>
}`,...d.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: args => <div className="flex flex-col gap-4">
      <Field label="Disabled">
        <MultiSelect {...args} disabled />
      </Field>
      <Field label="Labels" error="Add at least one Area label">
        <MultiSelect {...args} defaultValue={["bug"]} />
      </Field>
    </div>
}`,...i.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  render: () => <Field label="Subscribers" description="Searches the workspace directory.">
      <AsyncMultiSelect loader={searchPeople} defaultValue={[person("Grace Hopper"), person("Ken Thompson")]} placeholder="Add people" searchPlaceholder="Search people…" />
    </Field>
}`,...u.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: () => <AsyncMultiSelect aria-label="Subscribers" defaultOpen loader={(_query, signal) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Network error")), 500);
    signal.addEventListener("abort", () => clearTimeout(timer));
  })} placeholder="Add people" />
}`,...p.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [value, setValue] = useState<readonly string[]>(["feature", "mobile"]);
    return <Card className="w-96">
        <CardHeader>
          <CardTitle>Filter issues</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field label="Labels" description={\`\${value.length} selected\`}>
            <MultiSelect options={labels} value={value} onValueChange={setValue} placeholder="Any label" />
          </Field>
        </CardContent>
      </Card>;
  }
}`,...m.parameters?.docs?.source}}};export{u as Async,p as AsyncError,l as Collapsed,c as Empty,m as InAForm,n as Open,t as Playground,d as Sizes,i as States,z as __namedExportsOrder,P as default};
