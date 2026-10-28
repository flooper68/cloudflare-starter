import{A as y,r as g,j as r,C,e as x,f as w,g as L,F as v,h as j}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const A=["Ada Lovelace","Alan Turing","Barbara Liskov","Dennis Ritchie","Donald Knuth","Edsger Dijkstra","Frances Allen","Grace Hopper","Guido van Rossum","John McCarthy","Katherine Johnson","Ken Thompson","Leslie Lamport","Linus Torvalds","Margaret Hamilton","Radia Perlman","Tim Berners-Lee","Yukihiro Matsumoto"];function h(e){return{value:e.toLowerCase().replace(/\s/g,"-"),label:e,icon:r.jsx(j,{name:e,size:"xs"}),description:`${e.split(" ")[0]?.toLowerCase()}@acme.dev`}}function f(e,a){return new Promise((t,s)=>{const m=setTimeout(t,e);a.addEventListener("abort",()=>{clearTimeout(m),s(new DOMException("Aborted","AbortError"))})})}const b=async(e,a)=>{await f(300+Math.random()*400,a);const t=e.toLowerCase();return A.filter(s=>s.toLowerCase().includes(t)).slice(0,8).map(h)},O=async(e,a)=>{throw await f(500,a),new Error("503 Service Unavailable")},P={title:"Forms/AsyncSelect",component:y,tags:["autodocs"],args:{loader:b,placeholder:"Assign to…",searchPlaceholder:"Search people…",minQueryLength:0,debounceMs:200,size:"md",disabled:!1,deselectable:!0,"aria-label":"Assignee"},argTypes:{size:{control:"inline-radio",options:["sm","md","lg"]},loader:{control:!1}},decorators:[e=>r.jsx("div",{className:"h-96 w-72",children:r.jsx(e,{})})],parameters:{docs:{description:{component:"A Combobox whose options come from `loader(query, signal)`: debounced (200ms), stale\nrequests are aborted, and the list shows loading, empty and error (with retry) states.\n`minQueryLength` waits for a few characters before searching."}}}},l={},d={args:{defaultOpen:!0}},i={args:{defaultValue:h("Grace Hopper")}},o={args:{minQueryLength:2,defaultOpen:!0}},n={args:{loader:O,defaultOpen:!0}},c={args:{defaultOpen:!0,emptyText:"No one in Acme matches that name"}},u={args:{disabled:!0,defaultValue:h("Linus Torvalds")}},p={render:function(){const[a,t]=g.useState(null),[s,m]=g.useState(!1);return r.jsxs(C,{className:"w-80",children:[r.jsx(x,{children:r.jsx(w,{children:"Project lead"})}),r.jsx(L,{children:r.jsxs("form",{className:"flex flex-col gap-3",onSubmit:S=>{S.preventDefault(),m(!0)},children:[r.jsx(v,{label:"Lead",description:"Searches the whole workspace directory.",error:s&&!a?"Every project needs a lead":null,children:r.jsx(y,{loader:b,value:a,onValueChange:t,placeholder:"Choose a lead",searchPlaceholder:"Search people…"})}),r.jsx("button",{type:"submit",className:"sr-only",children:"Save"})]})})]})}},N=["Playground","Open","WithValue","MinimumQueryLength","ErrorState","EmptyState","Disabled","InAForm"];l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:"{}",...l.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    defaultOpen: true
  }
}`,...d.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: toOption("Grace Hopper")
  }
}`,...i.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    minQueryLength: 2,
    defaultOpen: true
  }
}`,...o.parameters?.docs?.source},description:{story:"Nothing loads until two characters are typed.",...o.parameters?.docs?.description}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    loader: failingSearch,
    defaultOpen: true
  }
}`,...n.parameters?.docs?.source},description:{story:"The loader rejects: the list shows the error and a retry button.",...n.parameters?.docs?.description}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    defaultOpen: true,
    emptyText: "No one in Acme matches that name"
  }
}`,...c.parameters?.docs?.source},description:{story:'Type a name that is not in the directory (e.g. "zzz") to see the empty state.',...c.parameters?.docs?.description}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true,
    defaultValue: toOption("Linus Torvalds")
  }
}`,...u.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  render: function Render() {
    const [lead, setLead] = useState<ComboboxOption | null>(null);
    const [submitted, setSubmitted] = useState(false);
    return <Card className="w-80">
        <CardHeader>
          <CardTitle>Project lead</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={event => {
          event.preventDefault();
          setSubmitted(true);
        }}>
            <Field label="Lead" description="Searches the whole workspace directory." error={submitted && !lead ? "Every project needs a lead" : null}>
              <AsyncSelect loader={searchPeople} value={lead} onValueChange={setLead} placeholder="Choose a lead" searchPlaceholder="Search people…" />
            </Field>
            <button type="submit" className="sr-only">
              Save
            </button>
          </form>
        </CardContent>
      </Card>;
  }
}`,...p.parameters?.docs?.source}}};export{u as Disabled,c as EmptyState,n as ErrorState,p as InAForm,o as MinimumQueryLength,d as Open,l as Playground,i as WithValue,N as __namedExportsOrder,P as default};
